import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HubAdminMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Accept both header formats:
    // 1. X-Hub-Api-Key: <key> (original)
    // 2. Authorization: Bearer <key> (Hub sends this)
    let apiKey = req.headers['x-hub-api-key'] as string;
    if (!apiKey) {
      const authHeader = req.headers['authorization'] as string;
      if (authHeader?.startsWith('Bearer ')) {
        apiKey = authHeader.slice(7);
      }
    }
    const expectedKey = process.env.HUB_ADMIN_API_KEY;

    if (!expectedKey) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: 'Hub integration not configured',
      });
      return;
    }

    if (!apiKey || apiKey !== expectedKey) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        error: 'Invalid or missing Hub API key',
      });
      return;
    }

    next();
  }
}
