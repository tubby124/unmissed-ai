export default function StatusPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6 py-12">
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-bold text-gray-900">Request received!</h1>
        <p className="text-gray-600 text-sm leading-relaxed">
          We&apos;ve got your setup details. We&apos;ll reach out within 1–2 business
          days to get your AI agent live.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 text-left space-y-2">
          <p className="font-semibold">What happens next:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-800">
            <li>We review your setup details</li>
            <li>We configure your custom AI agent</li>
            <li>We send you a test number to call before going live</li>
          </ol>
        </div>
        <p className="text-xs text-gray-400">
          Questions? Email{" "}
          <a href="mailto:support@unmissed.ai" className="underline">
            support@unmissed.ai
          </a>
        </p>
      </div>
    </div>
  );
}
