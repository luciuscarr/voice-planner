require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { google } = require('googleapis');

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error('Usage: node exchange-google-code.js <authorization_code>');
    process.exit(2);
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/auth-callback';
  const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);

  try {
    const { tokens } = await oauth2.getToken(String(code));
    console.log('Tokens received:');
    console.log(JSON.stringify(tokens, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Failed to exchange code for tokens:');
    if (err && err.response && err.response.data) {
      console.error('Response data:', err.response.data);
    }
    console.error(err);
    process.exit(1);
  }
}

main();
