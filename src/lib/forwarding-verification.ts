type ForwardingVerificationEnv = Record<string, string | undefined>

export function experimentalForwardingVerifyEnabled(
  env: ForwardingVerificationEnv = process.env as ForwardingVerificationEnv,
): boolean {
  return env.ENABLE_EXPERIMENTAL_FORWARDING_VERIFY === 'true'
}

export function experimentalForwardingVerifyDisabledPayload() {
  return {
    error: 'Automated forwarding verification is disabled',
    proof_required:
      'Forward missed calls from the normal business number, call that normal number from another phone, and confirm a captured call plus owner summary.',
  }
}
