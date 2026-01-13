/**
 * Script to register Pesapal IPN URL and get the IPN ID
 * 
 * Run with: npx tsx scripts/register-pesapal-ipn.ts
 */

const PESAPAL_API_URL = process.env.PESAPAL_API_URL || 'https://pay.pesapal.com/v3';
const PESAPAL_CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY;
const PESAPAL_CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
const CALLBACK_URL = 'https://kiosk.co.ke/api/pesapal/callback';

async function main() {
  console.log('='.repeat(60));
  console.log('Pesapal IPN Registration Script');
  console.log('='.repeat(60));
  
  if (!PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET) {
    console.error('\n❌ Error: Missing Pesapal credentials in environment');
    console.error('Make sure PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET are set');
    process.exit(1);
  }

  console.log(`\n📡 API URL: ${PESAPAL_API_URL}`);
  console.log(`🔗 Callback URL: ${CALLBACK_URL}`);
  
  // Step 1: Get auth token
  console.log('\n1️⃣  Getting authentication token...');
  
  const authResponse = await fetch(`${PESAPAL_API_URL}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      consumer_key: PESAPAL_CONSUMER_KEY,
      consumer_secret: PESAPAL_CONSUMER_SECRET,
    }),
  });

  if (!authResponse.ok) {
    const errorText = await authResponse.text();
    console.error(`❌ Auth failed: ${authResponse.status} - ${errorText}`);
    process.exit(1);
  }

  const authData = await authResponse.json();
  
  if (authData.error) {
    console.error(`❌ Auth error: ${authData.error.message}`);
    process.exit(1);
  }

  console.log('✅ Authentication successful');
  const token = authData.token;

  // Step 2: List existing IPNs
  console.log('\n2️⃣  Checking existing IPN registrations...');
  
  const listResponse = await fetch(`${PESAPAL_API_URL}/api/URLSetup/GetIpnList`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (listResponse.ok) {
    const ipnList = await listResponse.json();
    
    if (Array.isArray(ipnList) && ipnList.length > 0) {
      console.log(`\n📋 Found ${ipnList.length} existing IPN registration(s):\n`);
      
      for (const ipn of ipnList) {
        console.log(`   URL: ${ipn.url}`);
        console.log(`   IPN ID: ${ipn.ipn_id}`);
        console.log(`   Status: ${ipn.ipn_status}`);
        console.log(`   Type: ${ipn.ipn_notification_type}`);
        console.log('   ---');
        
        // Check if this is our callback URL
        if (ipn.url === CALLBACK_URL || ipn.url === CALLBACK_URL.replace('https://', 'http://')) {
          console.log('\n✅ Found matching IPN for your callback URL!');
          console.log('\n' + '='.repeat(60));
          console.log('Add this to your .env file:');
          console.log('='.repeat(60));
          console.log(`\nPESAPAL_IPN_ID=${ipn.ipn_id}\n`);
          console.log('='.repeat(60));
          process.exit(0);
        }
      }
    } else {
      console.log('   No existing IPN registrations found');
    }
  }

  // Step 3: Register new IPN
  console.log('\n3️⃣  Registering new IPN URL...');
  
  const registerResponse = await fetch(`${PESAPAL_API_URL}/api/URLSetup/RegisterIPN`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      url: CALLBACK_URL,
      ipn_notification_type: 'GET',
    }),
  });

  if (!registerResponse.ok) {
    const errorText = await registerResponse.text();
    console.error(`❌ Registration failed: ${registerResponse.status} - ${errorText}`);
    process.exit(1);
  }

  const registerData = await registerResponse.json();
  
  if (registerData.error) {
    console.error(`❌ Registration error: ${registerData.error.message}`);
    process.exit(1);
  }

  console.log('✅ IPN URL registered successfully!');
  
  console.log('\n' + '='.repeat(60));
  console.log('Add this to your .env file:');
  console.log('='.repeat(60));
  console.log(`\nPESAPAL_IPN_ID=${registerData.ipn_id}\n`);
  console.log('='.repeat(60));
  
  console.log('\nAlso add this to your production environment (Vercel, etc.):');
  console.log(`PESAPAL_IPN_ID=${registerData.ipn_id}`);
  console.log('\nThen restart your server and try M-Pesa payment again.');
}

main().catch(console.error);
