import { defaultAIGlobalPolicy } from "../../src/parallax/ai-policy";
import { openAIProviderConfiguration } from "../../src/parallax/openai-provider";

// Read-only local diagnostic: no network, database, dotenv loading or credential output.
const configuration = openAIProviderConfiguration(defaultAIGlobalPolicy);
process.stdout.write(
  JSON.stringify({
    credentialVariable: "OPENAI_API_KEY",
    configured: configuration.configured,
    provider: configuration.provider,
    policyEnabledByDefault: configuration.enabled,
    networkRequests: 0,
  }),
);
