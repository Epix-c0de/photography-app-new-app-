#!/usr/bin/env node

/**
 * USSD Test Script for Epix Visuals
 * 
 * This script simulates USSD sessions to test your USSD handler.
 * Run: node scripts/test-ussd.js
 * 
 * Usage:
 *   node scripts/test-ussd.js                    # Interactive mode
 *   node scripts/test-ussd.js --code ABC123      # Test specific code
 *   node scripts/test-ussd.js --phone +254712345678  # Test with phone number
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Test configuration
const config = {
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  defaultPhone: '+254712345678',
  defaultServiceCode: '123',
};

// USSD Menu simulation
async function simulateUSSD(phoneNumber, accessCode, option = '') {
  const text = option ? `${accessCode}*${option}` : accessCode;
  
  console.log('\n📱 Simulating USSD Session...');
  console.log('━'.repeat(50));
  console.log(`Phone: ${phoneNumber}`);
  console.log(`Dial: *${config.defaultServiceCode}*${text}#`);
  console.log('━'.repeat(50));

  try {
    const response = await fetch(`${config.supabaseUrl}/functions/v1/ussd-handler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        sessionId: `test_${Date.now()}`,
        phoneNumber: phoneNumber,
        serviceCode: config.defaultServiceCode,
        text: text,
      }),
    });

    const responseText = await response.text();
    
    console.log('\n📥 Response:');
    console.log('─'.repeat(50));
    
    // Parse USSD response format
    if (responseText.startsWith('CON')) {
      console.log('📱 Continue (Menu):');
      console.log(responseText.replace('CON ', '').replace(/\\n/g, '\n'));
      return { type: 'menu', text: responseText };
    } else if (responseText.startsWith('END')) {
      console.log('✅ End (Result):');
      console.log(responseText.replace('END ', '').replace(/\\n/g, '\n'));
      return { type: 'end', text: responseText };
    } else {
      console.log(responseText);
      return { type: 'unknown', text: responseText };
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { type: 'error', text: error.message };
  }
}

// Interactive menu
async function interactiveMode() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

  console.log('\n🎯 USSD Test Script for Epix Visuals');
  console.log('━'.repeat(50));

  while (true) {
    console.log('\n📋 Options:');
    console.log('1. Test initial menu (no code)');
    console.log('2. Test with access code');
    console.log('3. Test gallery menu option');
    console.log('4. Test help option');
    console.log('5. Test exit option');
    console.log('6. Custom test');
    console.log('0. Exit');

    const choice = await question('\nSelect option: ');

    switch (choice) {
      case '1':
        await simulateUSSD(config.defaultPhone, '');
        break;
      case '2':
        const code = await question('Enter access code: ');
        await simulateUSSD(config.defaultPhone, code);
        break;
      case '3':
        const code3 = await question('Enter access code: ');
        await simulateUSSD(config.defaultPhone, code3, '1');
        break;
      case '4':
        const code4 = await question('Enter access code: ');
        await simulateUSSD(config.defaultPhone, code4, '2');
        break;
      case '5':
        const code5 = await question('Enter access code: ');
        await simulateUSSD(config.defaultPhone, code5, '3');
        break;
      case '6':
        const phone = await question('Phone number: ');
        const code6 = await question('Access code: ');
        const opt = await question('Option (1-3, or empty): ');
        await simulateUSSD(phone, code6, opt);
        break;
      case '0':
        console.log('\n👋 Goodbye!');
        rl.close();
        process.exit(0);
      default:
        console.log('Invalid option');
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    phone: config.defaultPhone,
    code: '',
    option: '',
    interactive: true,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--phone':
      case '-p':
        result.phone = args[++i];
        result.interactive = false;
        break;
      case '--code':
      case '-c':
        result.code = args[++i];
        result.interactive = false;
        break;
      case '--option':
      case '-o':
        result.option = args[++i];
        result.interactive = false;
        break;
      case '--help':
      case '-h':
        console.log(`
USSD Test Script for Epix Visuals

Usage:
  node scripts/test-ussd.js [options]

Options:
  --phone, -p <number>    Phone number (default: +254712345678)
  --code, -c <code>       Access code to test
  --option, -o <1-3>      Menu option (1=Link, 2=Help, 3=Exit)
  --help, -h              Show this help

Examples:
  node scripts/test-ussd.js                           # Interactive mode
  node scripts/test-ussd.js --code ABC123             # Test code ABC123
  node scripts/test-ussd.js -c ABC123 -o 1           # Get link for ABC123
  node scripts/test-ussd.js -p +254700000000 -c XYZ  # Test with custom phone
`);
        process.exit(0);
    }
  }

  return result;
}

// Main
async function main() {
  const args = parseArgs();

  if (args.interactive) {
    await interactiveMode();
  } else {
    console.log('\n🎯 USSD Test - Epix Visuals');
    console.log('━'.repeat(50));
    
    const result = await simulateUSSD(args.phone, args.code, args.option);
    
    console.log('\n📊 Test Summary:');
    console.log('─'.repeat(50));
    console.log(`Status: ${result.type === 'error' ? '❌ Failed' : '✅ Success'}`);
    console.log(`Response Type: ${result.type}`);
    
    process.exit(result.type === 'error' ? 1 : 0);
  }
}

main().catch(console.error);
