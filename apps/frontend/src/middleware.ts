import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
import acceptLanguage from 'accept-language';
import {
  cookieName,
  fallbackLng,
  headerName,
  languages,
} from '@gitroom/react/translation/i18n.config';
acceptLanguage.languages(languages);

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  const nextUrl = request.nextUrl;
  const authCookie =
    request.cookies.get('auth') ||
    request.headers.get('auth') ||
    nextUrl.searchParams.get('loggedAuth');
  const lng = request.cookies.has(cookieName)
    ? acceptLanguage.get(request.cookies.get(cookieName).value)
    : acceptLanguage.get(
        request.headers.get('Accept-Language') ||
          request.headers.get('accept-language')
      );

  const topResponse = NextResponse.next();

  if (lng) {
    topResponse.headers.set(cookieName, lng);
  }

  if (nextUrl.pathname.startsWith('/modal/') && !authCookie) {
    return NextResponse.redirect(new URL(`/auth/login-required`, nextUrl.href));
  }

  if (
    nextUrl.pathname.startsWith('/uploads/') ||
    nextUrl.pathname.startsWith('/p/') ||
    nextUrl.pathname.startsWith('/icons/')
  ) {
    return topResponse;
  }
  // If the URL is logout, delete the cookie and redirect to login
  if (nextUrl.href.indexOf('/auth/logout') > -1) {
    const response = NextResponse.redirect(
      new URL('/auth/login', nextUrl.href)
    );
    response.cookies.set('auth', '', {
      path: '/',
      ...(!process.env.NOT_SECURED
        ? {
            secure: true,
            httpOnly: true,
            sameSite: false,
          }
        : {}),
      maxAge: -1,
      domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
    });
    return response;
  }

  // Handle forceAuth parameter - forces re-authentication by clearing session
  // Used by external systems (like BrandSpeak Hub) to ensure correct user context
  // Flow: clear auth cookie → redirect to login → OAuth re-authenticates → apply switchOrg
  const forceAuth = nextUrl.searchParams.get('forceAuth');
  const hubClientId = nextUrl.searchParams.get('hubClientId');
  if (forceAuth === 'true' && authCookie) {
    // Clear the auth cookie
    const cleanUrl = new URL(nextUrl.href);
    cleanUrl.searchParams.delete('forceAuth');

    // Redirect to self without forceAuth - middleware will then redirect to login
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set('auth', '', {
      path: '/',
      ...(!process.env.NOT_SECURED
        ? {
            secure: true,
            httpOnly: true,
            sameSite: false,
          }
        : {}),
      maxAge: -1,
      domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
    });

    // Store hubClientId in cookie BEFORE clearing session
    // This will be used by OAuth provider to fetch userinfo for correct client
    if (hubClientId) {
      response.cookies.set('hubClientId', hubClientId, {
        path: '/',
        ...(!process.env.NOT_SECURED
          ? {
              secure: true,
              httpOnly: true,
              sameSite: false,
              domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
            }
          : {}),
        expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      });
    }

    return response;
  }

  const org = nextUrl.searchParams.get('org');
  const url = new URL(nextUrl).search;
  const switchOrg = nextUrl.searchParams.get('switchOrg');

  if (nextUrl.href.indexOf('/auth') === -1 && !authCookie) {
    const providers = ['google', 'settings'];
    const findIndex = providers.find((p) => nextUrl.href.indexOf(p) > -1);
    const additional = !findIndex
      ? ''
      : (url.indexOf('?') > -1 ? '&' : '?') +
        `provider=${(findIndex === 'settings'
          ? process.env.POSTIZ_GENERIC_OAUTH
            ? 'generic'
            : 'github'
          : findIndex
        ).toUpperCase()}`;

    const redirect = NextResponse.redirect(
      new URL(`/auth${url}${additional}`, nextUrl.href)
    );

    // Preserve switchOrg through login redirect - will be applied after auth
    if (switchOrg) {
      redirect.cookies.set('pendingSwitchOrg', switchOrg, {
        ...(!process.env.NOT_SECURED
          ? {
              path: '/',
              secure: true,
              httpOnly: true,
              sameSite: false,
              domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
            }
          : {}),
        expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      });
    }

    // Preserve hubClientId through login redirect - used by OAuth to fetch correct userinfo
    if (hubClientId) {
      redirect.cookies.set('hubClientId', hubClientId, {
        ...(!process.env.NOT_SECURED
          ? {
              path: '/',
              secure: true,
              httpOnly: true,
              sameSite: false,
              domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
            }
          : {}),
        expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      });
    }

    return redirect;
  }

  // If the url is /auth and the cookie exists, redirect to /
  // Also check for pendingSwitchOrg from pre-login redirect and apply it
  if (nextUrl.href.indexOf('/auth') > -1 && authCookie) {
    const pendingSwitchOrg = request.cookies.get('pendingSwitchOrg')?.value;
    const targetUrl = pendingSwitchOrg
      ? (process.env.IS_GENERAL ? '/launches' : '/analytics')
      : `/${url}`;

    const redirect = NextResponse.redirect(new URL(targetUrl, nextUrl.href));

    if (pendingSwitchOrg) {
      // Apply the pending org switch
      redirect.cookies.set('showorg', pendingSwitchOrg, {
        ...(!process.env.NOT_SECURED
          ? {
              path: '/',
              secure: true,
              httpOnly: true,
              sameSite: false,
              domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
            }
          : {}),
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year
      });
      // Clear the pending cookie
      redirect.cookies.set('pendingSwitchOrg', '', {
        path: '/',
        maxAge: -1,
        domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
      });
    }

    return redirect;
  }
  if (nextUrl.href.indexOf('/auth') > -1 && !authCookie) {
    if (org) {
      const redirect = NextResponse.redirect(new URL(`/`, nextUrl.href));
      redirect.cookies.set('org', org, {
        ...(!process.env.NOT_SECURED
          ? {
              path: '/',
              secure: true,
              httpOnly: true,
              sameSite: false,
              domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
            }
          : {}),
        expires: new Date(Date.now() + 15 * 60 * 1000),
      });
      return redirect;
    }
    return topResponse;
  }

  // Handle switchOrg query parameter - allows external systems (like BrandSpeak Hub)
  // to specify which organization context to use when redirecting to Postiz
  // Note: switchOrg is already declared above for pre-login preservation
  if (switchOrg && authCookie) {
    // Remove switchOrg from URL to prevent it from persisting
    const cleanUrl = new URL(nextUrl.href);
    cleanUrl.searchParams.delete('switchOrg');
    const targetPath = cleanUrl.pathname === '/'
      ? (process.env.IS_GENERAL ? '/launches' : '/analytics')
      : cleanUrl.pathname;

    const redirect = NextResponse.redirect(new URL(targetPath + cleanUrl.search, cleanUrl.href));
    redirect.cookies.set('showorg', switchOrg, {
      ...(!process.env.NOT_SECURED
        ? {
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: false,
            domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
          }
        : {}),
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year
    });
    return redirect;
  }

  try {
    if (org) {
      const { id } = await (
        await internalFetch('/user/join-org', {
          body: JSON.stringify({
            org,
          }),
          method: 'POST',
        })
      ).json();
      const redirect = NextResponse.redirect(
        new URL(`/?added=true`, nextUrl.href)
      );
      if (id) {
        redirect.cookies.set('showorg', id, {
          ...(!process.env.NOT_SECURED
            ? {
                path: '/',
                secure: true,
                httpOnly: true,
                sameSite: false,
                domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
              }
            : {}),
          expires: new Date(Date.now() + 15 * 60 * 1000),
        });
      }
      return redirect;
    }
    if (nextUrl.pathname === '/') {
      return NextResponse.redirect(
        new URL(
          !!process.env.IS_GENERAL ? '/launches' : `/analytics`,
          nextUrl.href
        )
      );
    }

    return topResponse;
  } catch (err) {
    console.log('err', err);
    return NextResponse.redirect(new URL('/auth/logout', nextUrl.href));
  }
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)',
};
