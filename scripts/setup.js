#!/usr/bin/env node

import { execSync } from 'child_process';
import * as readline from 'readline';
import crypto from 'crypto';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

async function runCommand(command, errorMessage) {
  try {
    console.log(`\n> ${command}`);
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    if (errorMessage) {
      console.error(`\n❌ ${errorMessage}`);
    }
    // Return error instead of crashing, e.g., for R2 bucket creation if it exists
    return error;
  }
}

async function putSecret(secretName, secretValue) {
  try {
    execSync(`npx wrangler secret put ${secretName}`, { input: secretValue, stdio: ['pipe', 'inherit', 'inherit'] });
  } catch (err) {
    console.error(`❌ Failed to set secret: ${secretName}`);
  }
}

async function main() {
  console.log('\n=============================================');
  console.log('🦀 MOLTBOT ONE-CLICK DEPLOY WIZARD');
  console.log('=============================================\n');

  console.log('This wizard will prepare your Cloudflare environment and deploy Moltbot.\n');

  console.log('Step 1: Check Wrangler Authentication');
  try {
    execSync('npx wrangler whoami', { stdio: 'ignore' });
    console.log('✅ Logged into Cloudflare Wrangler.');
  } catch (e) {
    console.log('⚠️ You are not logged into Wrangler. Logging you in now...');
    await runCommand('npx wrangler login', 'Failed to log into Wrangler.');
  }

  // Generate Gateway Token
  const generatedToken = crypto.randomBytes(16).toString('hex');
  const useGenerated = await ask(`\nStep 2: Gateway Token\nYour MOLTBOT_GATEWAY_TOKEN secures remote access.\nUse auto-generated token (${generatedToken})? (Y/n): `);
  const gatewayToken = useGenerated.toLowerCase().startsWith('n') 
    ? await ask('Enter custom MOLTBOT_GATEWAY_TOKEN: ') 
    : generatedToken;
  
  console.log(`\nSetting MOLTBOT_GATEWAY_TOKEN...`);
  await putSecret('MOLTBOT_GATEWAY_TOKEN', gatewayToken);
  console.log('\n⚠️  SAVE THIS TOKEN! You will need it to load the UI:');
  console.log(`   ?token=${gatewayToken}\n`);

  // Cloudflare Access Info
  console.log('Step 3: Cloudflare Access (Admin UI Protection)');
  console.log('Please retrieve your Team Domain and Audience (AUD) tag from the Cloudflare Zero Trust Dashboard.');
  const teamDomain = await ask('Enter your CF_ACCESS_TEAM_DOMAIN (e.g., your-team.cloudflareaccess.com): ');
  const audTag = await ask('Enter your CF_ACCESS_AUD: ');
  
  if (teamDomain) await putSecret('CF_ACCESS_TEAM_DOMAIN', teamDomain.trim());
  if (audTag) await putSecret('CF_ACCESS_AUD', audTag.trim());

  // AI Provider
  console.log('\nStep 4: AI Provider Configuration');
  console.log('1) Direct Anthropic API Key');
  console.log('2) Direct OpenAI API Key');
  console.log('3) Cloudflare AI Gateway');
  const aiChoice = await ask('Which AI Provider setup would you like to use? (1/2/3): ');
  
  if (aiChoice === '3') {
    const cfAiKey = await ask('Enter CLOUDFLARE_AI_GATEWAY_API_KEY: ');
    const cfAiAccount = await ask('Enter CF_AI_GATEWAY_ACCOUNT_ID: ');
    const cfAiGateway = await ask('Enter CF_AI_GATEWAY_GATEWAY_ID: ');
    const cfAiModel = await ask('Enter CF_AI_GATEWAY_MODEL (e.g. anthropic/claude-3-5-sonnet-20241022 या openai/gpt-4o): ');
    if (cfAiKey) await putSecret('CLOUDFLARE_AI_GATEWAY_API_KEY', cfAiKey.trim());
    if (cfAiAccount) await putSecret('CF_AI_GATEWAY_ACCOUNT_ID', cfAiAccount.trim());
    if (cfAiGateway) await putSecret('CF_AI_GATEWAY_GATEWAY_ID', cfAiGateway.trim());
    if (cfAiModel) await putSecret('CF_AI_GATEWAY_MODEL', cfAiModel.trim());
  } else if (aiChoice === '2') {
    const oaiKey = await ask('Enter OPENAI_API_KEY: ');
    if (oaiKey) await putSecret('OPENAI_API_KEY', oaiKey.trim());
  } else {
    const anthropicKey = await ask('Enter ANTHROPIC_API_KEY: ');
    if (anthropicKey) await putSecret('ANTHROPIC_API_KEY', anthropicKey.trim());
  }

  // R2 Bucket
  console.log('\nStep 5: Provisioning infrastructure...');
  console.log('Creating moltbot-data R2 storage bucket...');
  // Piping stderr to devnull to hide "already exists" errors to keep the output clean
  try {
    execSync('npx wrangler r2 bucket create moltbot-data', { stdio: 'ignore' });
    console.log('✅ Created R2 bucket: moltbot-data');
  } catch (e) {
    console.log('✅ R2 bucket "moltbot-data" already exists.');
    const resetConfig = await ask('\nDo you want to clear your remote AI configuring to apply these new keys? (Recommended if changing providers) [y/N]: ');
    if (resetConfig.toLowerCase().startsWith('y')) {
      try {
        execSync('npx wrangler r2 object delete moltbot-data/openclaw/openclaw.json', { stdio: 'ignore' });
        console.log('✅ Remote OpenClaw configuration cleared.');
      } catch (err) {
        // file un-deletable or missing
      }
    }
  }

  // Deployment
  console.log('\nStep 6: Deploying Moltbot to Cloudflare Edge...');
  await runCommand('npm install', 'Failed to install NPM packages.');
  await runCommand('npm run build', 'Failed to build the generic UI frontend.');
  await runCommand('npx wrangler deploy', 'Deployment failed!');

  console.log('\n=============================================');
  console.log('🚀 DEPLOYMENT COMPLETE!');
  console.log(`To use your personal assistant, append your gateway token:`);
  console.log(`?token=${gatewayToken}`);
  console.log('Make sure to whitelist your email in the Zero Trust Dashboard to access /_admin');
  console.log('=============================================\n');

  rl.close();
}

main().catch(console.error);
