import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { CreateHubOrganizationDto } from '@gitroom/nestjs-libraries/dtos/admin/create.hub.organization.dto';

@ApiTags('Admin')
@Controller('/api/admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private _organizationService: OrganizationService) {}

  /**
   * Create organization for Hub provisioning
   * Idempotent - returns existing org if hubClientId already exists
   */
  @Post('/organizations')
  async createOrganization(@Body() body: CreateHubOrganizationDto) {
    this.logger.log({
      message: 'Hub Admin: Provisioning organization request',
      hubClientId: body.hubClientId,
      name: body.name,
      adminEmail: body.adminEmail,
    });

    // Check if organization already exists (idempotent)
    const existing = await this._organizationService.getOrgByHubClientId(
      body.hubClientId
    );

    if (existing) {
      this.logger.log({
        message: 'Hub Admin: Org already exists, returning existing',
        hubClientId: body.hubClientId,
        orgId: existing.id,
        action: 'skip_existing',
      });

      return {
        id: existing.id,
        hubClientId: existing.hubClientId,
        name: existing.name,
        createdAt: existing.createdAt,
        status: 'active',
        _existed: true,
      };
    }

    try {
      // Parse timezone if provided
      const timezone = body.settings?.timezone
        ? this.parseTimezone(body.settings.timezone)
        : 0;

      // Create new organization
      const org = await this._organizationService.createOrgForHub(
        body.name,
        body.hubClientId,
        body.adminEmail,
        timezone
      );

      this.logger.log({
        message: 'Hub Admin: New org created successfully',
        hubClientId: body.hubClientId,
        orgId: org.id,
        name: org.name,
        action: 'create',
      });

      return {
        id: org.id,
        hubClientId: org.hubClientId,
        name: org.name,
        createdAt: org.createdAt,
        status: 'active',
      };
    } catch (error: any) {
      // Handle P2002 unique constraint violation
      if (error.code === 'P2002') {
        const target = error.meta?.target as string[] | undefined;

        // Check if it's a hubClientId conflict (race condition)
        if (target?.includes('hubClientId')) {
          this.logger.warn({
            message: 'Hub Admin: Race condition on hubClientId, fetching existing org',
            hubClientId: body.hubClientId,
          });

          const existing = await this._organizationService.getOrgByHubClientId(
            body.hubClientId
          );
          if (existing) {
            return {
              id: existing.id,
              hubClientId: existing.hubClientId,
              name: existing.name,
              createdAt: existing.createdAt,
              status: 'active',
              _existed: true,
            };
          }
        }

        // Check if it's an email conflict
        if (target?.includes('email')) {
          this.logger.warn({
            message: 'Hub Admin: Admin email already exists',
            hubClientId: body.hubClientId,
            adminEmail: body.adminEmail,
          });

          throw new HttpException(
            { error: 'Admin email already exists with this provider' },
            HttpStatus.CONFLICT
          );
        }
      }

      this.logger.error({
        message: 'Hub Admin: Failed to create org',
        hubClientId: body.hubClientId,
        error: error.message,
      });

      throw new HttpException(
        { error: error.message || 'Failed to create organization' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Parse timezone string to offset (basic implementation)
   * Can be enhanced with moment-timezone for full timezone support
   */
  private parseTimezone(timezone: string): number {
    // Basic timezone offset mapping
    // For full support, use a library like moment-timezone
    const timezoneOffsets: Record<string, number> = {
      'America/New_York': -5,
      'America/Chicago': -6,
      'America/Denver': -7,
      'America/Los_Angeles': -8,
      'Europe/London': 0,
      'Europe/Paris': 1,
      'Europe/Berlin': 1,
      'Asia/Tokyo': 9,
      'Asia/Shanghai': 8,
      'Australia/Sydney': 11,
      UTC: 0,
    };

    return timezoneOffsets[timezone] ?? 0;
  }
}
