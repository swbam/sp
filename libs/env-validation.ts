/**
 * Environment Variables Validation for MySetlist
 * 
 * This module validates all required environment variables at runtime
 * and provides clear error messages for missing or invalid values.
 */

interface EnvVar {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'url' | 'jwt' | 'api_key';
  description: string;
  example?: string;
  pattern?: RegExp;
}

// Define all environment variables with their requirements
const ENV_VARS: EnvVar[] = [
  // App Configuration
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: true,
    type: 'url',
    description: 'The public URL of the application',
    example: 'https://mysetlist.com',
    pattern: /^https?:\/\/.+/
  },
  {
    name: 'NEXT_PUBLIC_APP_ENV',
    required: true,
    type: 'string',
    description: 'The environment the app is running in',
    example: 'production',
    pattern: /^(development|staging|production)$/
  },
  {
    name: 'NODE_ENV',
    required: true,
    type: 'string',
    description: 'Node.js environment',
    example: 'production',
    pattern: /^(development|test|production)$/
  },

  // Supabase Configuration
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    type: 'url',
    description: 'Supabase project URL',
    example: 'https://eotvxxipggnqxonvzkks.supabase.co',
    pattern: /^https:\/\/.+\.supabase\.co$/
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    type: 'jwt',
    description: 'Supabase anonymous key',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    pattern: /^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    type: 'jwt',
    description: 'Supabase service role key (server-side only)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    pattern: /^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
  },

  // External API Keys
  {
    name: 'SPOTIFY_CLIENT_ID',
    required: true,
    type: 'api_key',
    description: 'Spotify API client ID',
    example: '2946864dc822469b9c672292ead45f43',
    pattern: /^[a-f0-9]{32}$/
  },
  {
    name: 'SPOTIFY_CLIENT_SECRET',
    required: true,
    type: 'api_key',
    description: 'Spotify API client secret',
    example: 'feaf0fc901124b839b11e02f97d18a8d',
    pattern: /^[a-f0-9]{32}$/
  },
  {
    name: 'TICKETMASTER_API_KEY',
    required: true,
    type: 'api_key',
    description: 'Ticketmaster API key',
    example: 'k8GrSAkbFaN0w7qDxGl7ohr8LwdAQm9b',
    pattern: /^[A-Za-z0-9]+$/
  },
  {
    name: 'SETLISTFM_API_KEY',
    required: true,
    type: 'api_key',
    description: 'Setlist.fm API key',
    example: 'xkutflW-aRy_Df9rF4OkJyCsHBYN88V37EBL',
    pattern: /^[A-Za-z0-9_-]+$/
  },

  // Security
  {
    name: 'JWT_SECRET',
    required: true,
    type: 'string',
    description: 'JWT signing secret',
    example: 'very-long-random-string-for-jwt-signing',
    pattern: /^.{32,}$/ // At least 32 characters
  },
  {
    name: 'CRON_SECRET',
    required: true,
    type: 'string',
    description: 'Secret for cron job authentication',
    example: '6155002300',
    pattern: /^[A-Za-z0-9]{10,}$/ // At least 10 characters
  }
];

// Optional environment variables
const OPTIONAL_ENV_VARS: EnvVar[] = [
  {
    name: 'VERCEL_ANALYTICS_ID',
    required: false,
    type: 'string',
    description: 'Vercel Analytics ID',
    example: 'prj_abc123'
  },
  {
    name: 'SENTRY_DSN',
    required: false,
    type: 'url',
    description: 'Sentry DSN for error tracking',
    example: 'https://abc123@sentry.io/123456'
  },
  {
    name: 'GOOGLE_SITE_VERIFICATION',
    required: false,
    type: 'string',
    description: 'Google Site Verification code',
    example: 'abc123def456'
  }
];

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  missing: string[];
  invalid: string[];
}

/**
 * Validates all environment variables
 */
export function validateEnvironmentVariables(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];

  // Check required environment variables
  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value) {
      missing.push(envVar.name);
      errors.push(`Missing required environment variable: ${envVar.name}`);
      errors.push(`  Description: ${envVar.description}`);
      if (envVar.example) {
        errors.push(`  Example: ${envVar.example}`);
      }
      continue;
    }

    // Validate pattern if provided
    if (envVar.pattern && !envVar.pattern.test(value)) {
      invalid.push(envVar.name);
      errors.push(`Invalid format for ${envVar.name}`);
      errors.push(`  Expected pattern: ${envVar.pattern.toString()}`);
      if (envVar.example) {
        errors.push(`  Example: ${envVar.example}`);
      }
    }

    // Type-specific validation
    switch (envVar.type) {
      case 'url':
        try {
          new URL(value);
        } catch {
          invalid.push(envVar.name);
          errors.push(`Invalid URL format for ${envVar.name}: ${value}`);
        }
        break;
      case 'number':
        if (isNaN(Number(value))) {
          invalid.push(envVar.name);
          errors.push(`Invalid number format for ${envVar.name}: ${value}`);
        }
        break;
      case 'boolean':
        if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
          invalid.push(envVar.name);
          errors.push(`Invalid boolean format for ${envVar.name}: ${value}`);
        }
        break;
    }
  }

  // Check optional environment variables
  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = process.env[envVar.name];
    
    if (!value) {
      warnings.push(`Optional environment variable not set: ${envVar.name}`);
      warnings.push(`  Description: ${envVar.description}`);
      continue;
    }

    // Validate pattern if provided
    if (envVar.pattern && !envVar.pattern.test(value)) {
      warnings.push(`Invalid format for optional ${envVar.name}`);
      if (envVar.example) {
        warnings.push(`  Example: ${envVar.example}`);
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    missing,
    invalid
  };
}

/**
 * Validates environment variables and throws if any are missing or invalid
 */
export function validateEnvironmentVariablesOrThrow(): void {
  const result = validateEnvironmentVariables();
  
  if (!result.success) {
    console.error('❌ Environment validation failed:');
    result.errors.forEach(error => console.error(`  ${error}`));
    
    if (result.missing.length > 0) {
      console.error('\n📋 Missing variables:');
      result.missing.forEach(name => console.error(`  - ${name}`));
    }
    
    if (result.invalid.length > 0) {
      console.error('\n🚫 Invalid variables:');
      result.invalid.forEach(name => console.error(`  - ${name}`));
    }
    
    console.error('\n💡 Check VERCEL_ENV_TEMPLATE.md for configuration instructions');
    
    throw new Error(`Environment validation failed: ${result.errors.length} errors`);
  }
  
  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment warnings:');
    result.warnings.forEach(warning => console.warn(`  ${warning}`));
  }
  
  console.log('✅ Environment validation passed');
}

/**
 * Gets a validated environment variable
 */
export function getEnvVar(name: string): string {
  const value = process.env[name];
  
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  
  return value;
}

/**
 * Gets a validated environment variable with a default value
 */
export function getEnvVarWithDefault(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Gets the current environment
 */
export function getCurrentEnvironment(): 'development' | 'staging' | 'production' {
  const env = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV;
  
  if (!env || !['development', 'staging', 'production'].includes(env)) {
    throw new Error('Invalid or missing environment configuration');
  }
  
  return env as 'development' | 'staging' | 'production';
}

/**
 * Checks if the app is running in production
 */
export function isProduction(): boolean {
  return getCurrentEnvironment() === 'production';
}

/**
 * Checks if the app is running in development
 */
export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'development';
}

/**
 * Environment-specific configuration
 */
export const envConfig = {
  app: {
    url: getEnvVar('NEXT_PUBLIC_APP_URL'),
    env: getCurrentEnvironment(),
    isProduction: isProduction(),
    isDevelopment: isDevelopment()
  },
  supabase: {
    url: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
  },
  api: {
    spotify: {
      clientId: getEnvVar('SPOTIFY_CLIENT_ID'),
      clientSecret: getEnvVar('SPOTIFY_CLIENT_SECRET')
    },
    ticketmaster: {
      apiKey: getEnvVar('TICKETMASTER_API_KEY')
    },
    setlistFm: {
      apiKey: getEnvVar('SETLISTFM_API_KEY')
    }
  },
  security: {
    jwtSecret: getEnvVar('JWT_SECRET'),
    cronSecret: getEnvVar('CRON_SECRET')
  }
};

// Auto-validate on module import in production
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  validateEnvironmentVariablesOrThrow();
}