import { Injectable, Logger } from '@nestjs/common';
import { Provider, Role, User } from '@prisma/client';
import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { LoginUserDto } from '@gitroom/nestjs-libraries/dtos/auth/login.user.dto';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { AuthService as AuthChecker } from '@gitroom/helpers/auth/auth.service';
import { ProvidersFactory } from '@gitroom/backend/services/auth/providers/providers.factory';
import dayjs from 'dayjs';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { ForgotReturnPasswordDto } from '@gitroom/nestjs-libraries/dtos/auth/forgot-return.password.dto';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';
import { NewsletterService } from '@gitroom/nestjs-libraries/newsletter/newsletter.service';

// Hub role → Postiz role mapping
const HUB_ROLE_MAP: Record<string, Role> = {
  admin: Role.ADMIN,
  manager: Role.ADMIN,
  editor: Role.USER,
  viewer: Role.USER,
};

// Check if Hub OAuth mode is enabled
const isHubOAuthEnabled = () => process.env.HUB_OAUTH_ENABLED === 'true';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private _userService: UsersService,
    private _organizationService: OrganizationService,
    private _notificationService: NotificationService,
    private _emailService: EmailService
  ) {}
  async canRegister(provider: string) {
    if (process.env.DISABLE_REGISTRATION !== 'true' || provider === Provider.GENERIC) {
      return true;
    }

    return (await this._organizationService.getCount()) === 0;
  }

  async routeAuth(
    provider: Provider,
    body: CreateOrgUserDto | LoginUserDto,
    ip: string,
    userAgent: string,
    addToOrg?: boolean | { orgId: string; role: 'USER' | 'ADMIN'; id: string }
  ) {
    if (provider === Provider.LOCAL) {
      if (process.env.DISALLOW_PLUS && body.email.includes('+')) {
        throw new Error('Email with plus sign is not allowed');
      }
      const user = await this._userService.getUserByEmail(body.email);
      if (body instanceof CreateOrgUserDto) {
        if (user) {
          throw new Error('Email already exists');
        }

        if (!(await this.canRegister(provider))) {
          throw new Error('Registration is disabled');
        }

        const create = await this._organizationService.createOrgAndUser(
          body,
          ip,
          userAgent
        );

        const addedOrg =
          addToOrg && typeof addToOrg !== 'boolean'
            ? await this._organizationService.addUserToOrg(
                create.users[0].user.id,
                addToOrg.id,
                addToOrg.orgId,
                addToOrg.role
              )
            : false;

        const obj = { addedOrg, jwt: await this.jwt(create.users[0].user) };
        await this._emailService.sendEmail(
          body.email,
          'Activate your account',
          `Click <a href="${process.env.FRONTEND_URL}/auth/activate/${obj.jwt}">here</a> to activate your account`
        );
        return obj;
      }

      if (!user || !AuthChecker.comparePassword(body.password, user.password)) {
        throw new Error('Invalid user name or password');
      }

      if (!user.activated) {
        throw new Error('User is not activated');
      }

      return { addedOrg: false, jwt: await this.jwt(user) };
    }

    const user = await this.loginOrRegisterProvider(
      provider,
      body as CreateOrgUserDto,
      ip,
      userAgent
    );

    const addedOrg =
      addToOrg && typeof addToOrg !== 'boolean'
        ? await this._organizationService.addUserToOrg(
            user.id,
            addToOrg.id,
            addToOrg.orgId,
            addToOrg.role
          )
        : false;
    return { addedOrg, jwt: await this.jwt(user) };
  }

  public getOrgFromCookie(cookie?: string) {
    if (!cookie) {
      return false;
    }

    try {
      const getOrg: any = AuthChecker.verifyJWT(cookie);
      if (dayjs(getOrg.timeLimit).isBefore(dayjs())) {
        return false;
      }

      return getOrg as {
        email: string;
        role: 'USER' | 'ADMIN';
        orgId: string;
        id: string;
      };
    } catch (err) {
      return false;
    }
  }

  private async loginOrRegisterProvider(
    provider: Provider,
    body: CreateOrgUserDto,
    ip: string,
    userAgent: string
  ) {
    const providerInstance = ProvidersFactory.loadProvider(provider);
    const providerUser = await providerInstance.getUser(body.providerToken);

    if (!providerUser) {
      throw new Error('Invalid provider token');
    }

    const user = await this._userService.getUserByProvider(
      providerUser.id,
      provider
    );
    if (user) {
      // Existing user - check if we need to add them to Hub org
      if (isHubOAuthEnabled() && body.hubOrgId) {
        await this.ensureUserInHubOrg(user.id, body.hubOrgId, body.hubRole);
      }
      return user;
    }

    if (!(await this.canRegister(provider))) {
      throw new Error('Registration is disabled');
    }

    // If Hub org context is provided, add user to existing Hub org instead of creating new org
    if (isHubOAuthEnabled() && body.hubOrgId) {
      this.logger.log({
        message: 'Hub OAuth: Creating user and adding to existing Hub org',
        hubOrgId: body.hubOrgId,
        hubRole: body.hubRole,
        email: providerUser.email,
      });

      const newUser = await this._organizationService.createUserForHubOrg(
        {
          email: providerUser.email,
          provider,
          providerId: providerUser.id,
        },
        body.hubOrgId,
        this.mapHubRole(body.hubRole),
        ip,
        userAgent
      );

      await NewsletterService.register(providerUser.email);
      return newUser;
    }

    // Standard flow - create new org and user
    const create = await this._organizationService.createOrgAndUser(
      {
        company: body.company,
        email: providerUser.email,
        password: '',
        provider,
        providerId: providerUser.id,
      },
      ip,
      userAgent
    );

    await NewsletterService.register(providerUser.email);

    return create.users[0].user;
  }

  /**
   * Ensure user is in Hub org with correct role
   */
  private async ensureUserInHubOrg(userId: string, hubOrgId: string, hubRole?: string) {
    const hubOrg = await this._organizationService.getOrgById(hubOrgId);
    if (!hubOrg) {
      this.logger.warn({
        message: 'Hub OAuth: Hub org not found',
        hubOrgId,
        userId,
      });
      return;
    }

    // Check if user is already in this org
    const userOrgs = await this._organizationService.getOrgsByUserId(userId);
    const alreadyInOrg = userOrgs.some(org => org.id === hubOrgId);

    if (!alreadyInOrg) {
      const role = this.mapHubRole(hubRole);
      await this._organizationService.addUserToHubOrg(hubOrgId, userId, role);

      this.logger.log({
        message: 'Hub OAuth: Added existing user to Hub org',
        userId,
        hubOrgId,
        hubRole,
        mappedRole: role,
      });
    }
  }

  async forgot(email: string) {
    const user = await this._userService.getUserByEmail(email);
    if (!user || user.providerName !== Provider.LOCAL) {
      return false;
    }

    const resetValues = AuthChecker.signJWT({
      id: user.id,
      expires: dayjs().add(20, 'minutes').format('YYYY-MM-DD HH:mm:ss'),
    });

    await this._notificationService.sendEmail(
      user.email,
      'Reset your password',
      `You have requested to reset your passsord. <br />Click <a href="${process.env.FRONTEND_URL}/auth/forgot/${resetValues}">here</a> to reset your password<br />The link will expire in 20 minutes`
    );
  }

  forgotReturn(body: ForgotReturnPasswordDto) {
    const user = AuthChecker.verifyJWT(body.token) as {
      id: string;
      expires: string;
    };
    if (dayjs(user.expires).isBefore(dayjs())) {
      return false;
    }

    return this._userService.updatePassword(user.id, body.password);
  }

  async activate(code: string) {
    const user = AuthChecker.verifyJWT(code) as {
      id: string;
      activated: boolean;
      email: string;
    };
    if (user.id && !user.activated) {
      const getUserAgain = await this._userService.getUserByEmail(user.email);
      if (getUserAgain.activated) {
        return false;
      }
      await this._userService.activateUser(user.id);
      user.activated = true;
      await NewsletterService.register(user.email);
      return this.jwt(user as any);
    }

    return false;
  }

  oauthLink(provider: string, query?: any) {
    const providerInstance = ProvidersFactory.loadProvider(
      provider as Provider
    );
    return providerInstance.generateLink(query);
  }

  async checkExists(provider: string, code: string, hubClientId?: string) {
    const providerInstance = ProvidersFactory.loadProvider(
      provider as Provider
    );
    const token = await providerInstance.getToken(code);
    // Pass hubClientId to getUser so it can be included in userinfo request
    // This tells Hub which client context to use when user has multiple clients
    const user = await providerInstance.getUser(token, hubClientId);
    if (!user) {
      throw new Error('Invalid user');
    }
    const checkExists = await this._userService.getUserByProvider(
      user.id,
      provider as Provider
    );

    // Handle Hub organization context (only when Hub OAuth mode is enabled)
    if (checkExists) {
      // Existing user - check if we need to add them to Hub org
      if (isHubOAuthEnabled() && user.hubClientId) {
        this.logger.log({
          message: 'Hub OAuth: Resolving org for existing user',
          userId: checkExists.id,
          hubClientId: user.hubClientId,
          hubRole: user.hubRole,
        });

        const hubOrg = await this._organizationService.getOrgByHubClientId(
          user.hubClientId
        );
        if (hubOrg) {
          this.logger.log({
            message: 'Hub OAuth: Org resolved by hubClientId',
            userId: checkExists.id,
            hubClientId: user.hubClientId,
            orgId: hubOrg.id,
            orgName: hubOrg.name,
          });

          // Check if user is already in this org
          const userInOrg = hubOrg.users.find(
            (u) => u.userId === checkExists.id
          );
          if (!userInOrg) {
            // Add user to Hub org with mapped role
            const role = this.mapHubRole(user.hubRole);
            await this._organizationService.addUserToHubOrg(
              hubOrg.id,
              checkExists.id,
              role
            );

            this.logger.log({
              message: 'Hub OAuth: User added to org with role mapping',
              userId: checkExists.id,
              orgId: hubOrg.id,
              hubRole: user.hubRole,
              mappedRole: role,
            });
          }
          // Return JWT with Hub org context for switching
          return { jwt: await this.jwt(checkExists), switchToOrg: hubOrg.id };
        }
      }
      return { jwt: await this.jwt(checkExists) };
    }

    // New user - include Hub context in token if available
    if (isHubOAuthEnabled() && user.hubClientId) {
      this.logger.log({
        message: 'Hub OAuth: Resolving org for new user',
        userEmail: user.email,
        hubClientId: user.hubClientId,
        hubRole: user.hubRole,
      });

      const hubOrg = await this._organizationService.getOrgByHubClientId(
        user.hubClientId
      );
      if (hubOrg) {
        const mappedRole = this.mapHubRole(user.hubRole);

        this.logger.log({
          message: 'Hub OAuth: Org resolved for new user registration',
          userEmail: user.email,
          hubClientId: user.hubClientId,
          orgId: hubOrg.id,
          hubRole: user.hubRole,
          mappedRole: mappedRole,
        });

        // Hub org exists, return token with org context
        return {
          token,
          hubOrgId: hubOrg.id,
          hubRole: mappedRole,
        };
      }
    }

    return { token };
  }

  /**
   * Map Hub role to Postiz role
   */
  private mapHubRole(hubRole?: string): Role {
    if (!hubRole) return Role.USER;
    return HUB_ROLE_MAP[hubRole.toLowerCase()] || Role.USER;
  }

  private async jwt(user: User) {
    return AuthChecker.signJWT(user);
  }
}
