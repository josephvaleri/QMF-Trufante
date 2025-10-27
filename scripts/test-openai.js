console.log('Testing OpenAI import...');

try {
  const OpenAI = require('openai');
  console.log('OpenAI imported:', typeof OpenAI);
  console.log('OpenAI keys:', Object.keys(OpenAI));
  
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || ''
  });
  
  console.log('Client created:', typeof client);
  console.log('Client methods:', Object.getOwnPropertyNames(client));
  console.log('beta property:', typeof client.beta);
  
  if (client.beta) {
    console.log('beta methods:', Object.getOwnPropertyNames(client.beta));
    console.log('vectorStores property:', typeof client.beta.vectorStores);
  }
  
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
