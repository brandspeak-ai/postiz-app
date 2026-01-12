import {
  ValidationArguments,
  ValidatorConstraintInterface,
  ValidatorConstraint,
} from 'class-validator';

@ValidatorConstraint({ name: 'checkValidExtension', async: false })
export class ValidUrlExtension implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    return (
      !!text?.split?.('?')?.[0].endsWith('.png') ||
      !!text?.split?.('?')?.[0].endsWith('.jpg') ||
      !!text?.split?.('?')?.[0].endsWith('.jpeg') ||
      !!text?.split?.('?')?.[0].endsWith('.gif') ||
      !!text?.split?.('?')?.[0].endsWith('.mp4')
    );
  }

  defaultMessage(args: ValidationArguments) {
    // here you can provide default error message if validation failed
    return (
      'File must have a valid extension: .png, .jpg, .jpeg, .gif, or .mp4'
    );
  }
}

@ValidatorConstraint({ name: 'checkValidPath', async: false })
export class ValidUrlPath implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    if (!process.env.RESTRICT_UPLOAD_DOMAINS) {
      return true;
    }

    const url = text || '';
    const allowedDomains = process.env.RESTRICT_UPLOAD_DOMAINS.split(',').map(d => d.trim());

    return allowedDomains.some(domain => {
      // Support wildcard patterns like *.brandspeak.ai
      if (domain.startsWith('*.')) {
        const baseDomain = domain.slice(2); // Remove '*.'
        // Match the base domain or any subdomain
        return url.includes('.' + baseDomain) || url.includes('//' + baseDomain);
      }
      return url.includes(domain);
    });
  }

  defaultMessage(args: ValidationArguments) {
    // here you can provide default error message if validation failed
    return (
      'URL must contain an allowed domain: ' + process.env.RESTRICT_UPLOAD_DOMAINS
    );
  }
}
