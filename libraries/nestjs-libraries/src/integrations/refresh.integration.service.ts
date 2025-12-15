import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Integration } from '@prisma/client';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import {
  AuthTokenDetails,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

@Injectable()
export class RefreshIntegrationService {
  private readonly logger = new Logger(RefreshIntegrationService.name);

  constructor(
    private _integrationManager: IntegrationManager,
    @Inject(forwardRef(() => IntegrationService))
    private _integrationService: IntegrationService
  ) {}
  async refresh(integration: Integration): Promise<false | AuthTokenDetails> {
    this.logger.log(
      `[TOKEN_REFRESH] Starting refresh for integration: ${integration.id} ` +
      `(${integration.providerIdentifier}/${integration.name}) ` +
      `tokenExpiration: ${integration.tokenExpiration}`
    );

    const socialProvider = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    const refresh = await this.refreshProcess(integration, socialProvider);

    if (!refresh) {
      this.logger.error(
        `[TOKEN_REFRESH] FAILED for integration: ${integration.id} ` +
        `(${integration.providerIdentifier}/${integration.name})`
      );
      return false as const;
    }

    this.logger.log(
      `[TOKEN_REFRESH] SUCCESS for integration: ${integration.id} ` +
      `(${integration.providerIdentifier}/${integration.name}) - updating token`
    );

    await this._integrationService.createOrUpdateIntegration(
      undefined,
      !!socialProvider.oneTimeToken,
      integration.organizationId,
      integration.name,
      integration.picture!,
      'social',
      integration.internalId,
      integration.providerIdentifier,
      refresh.accessToken,
      refresh.refreshToken,
      refresh.expiresIn
    );

    return refresh;
  }

  private async refreshProcess(
    integration: Integration,
    socialProvider: SocialProvider
  ): Promise<AuthTokenDetails | false> {
    const refresh: false | AuthTokenDetails = await socialProvider
      .refreshToken(integration.refreshToken)
      .catch((err) => {
        this.logger.error(
          `[TOKEN_REFRESH] Error refreshing token for integration: ${integration.id} ` +
          `(${integration.providerIdentifier}/${integration.name}) - ` +
          `Error: ${err?.message || err}`,
          err?.stack
        );
        // Log additional details for OAuth errors
        if (err?.response?.data) {
          this.logger.error(
            `[TOKEN_REFRESH] OAuth error response: ${JSON.stringify(err.response.data)}`
          );
        }
        return false;
      });

    if (!refresh) {
      this.logger.warn(
        `[TOKEN_REFRESH] Marking integration as needing refresh: ${integration.id} ` +
        `(${integration.providerIdentifier}/${integration.name})`
      );

      await this._integrationService.refreshNeeded(
        integration.organizationId,
        integration.id
      );

      await this._integrationService.informAboutRefreshError(
        integration.organizationId,
        integration
      );

      await this._integrationService.disconnectChannel(integration.organizationId, integration);

      return false;
    }

    if (!socialProvider.reConnect) {
      return refresh;
    }

    const reConnect = await socialProvider.reConnect(
      integration.rootInternalId,
      integration.internalId,
      refresh.accessToken
    );

    return {
      ...refresh,
      ...reConnect,
    };
  }
}
