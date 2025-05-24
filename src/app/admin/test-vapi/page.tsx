import {
	debugVapiConnection,
	testVapiDirect
} from "@/actions/admin-phone-numbers"

export default async function TestVapiPage() {
	const results = {
		direct: null as unknown,
		wrapper: null as unknown,
		directError: null as Error | unknown,
		wrapperError: null as Error | unknown
	}

	// Test direct Vapi SDK
	try {
		results.direct = await testVapiDirect()
	} catch (error) {
		results.directError = error
	}

	// Test our wrapper
	try {
		results.wrapper = await debugVapiConnection()
	} catch (error) {
		results.wrapperError = error
	}

	return (
		<div className="p-8 space-y-8">
			<h1 className="text-2xl font-bold mb-4">Vapi Debug Results</h1>

			<div className="border rounded-lg p-4">
				<h2 className="text-lg font-semibold mb-2">
					Direct Vapi SDK Test
				</h2>
				{results.directError ? (
					<div className="bg-red-100 p-4 rounded text-red-800">
						<strong>Error:</strong>
						<pre>
							{results.directError instanceof Error
								? results.directError.message
								: String(results.directError)}
						</pre>
					</div>
				) : (
					<div className="bg-green-100 p-4 rounded text-green-800">
						<strong>Success:</strong>
						<pre>{JSON.stringify(results.direct, null, 2)}</pre>
					</div>
				)}
			</div>

			<div className="border rounded-lg p-4">
				<h2 className="text-lg font-semibold mb-2">Wrapper Test</h2>
				{results.wrapperError ? (
					<div className="bg-red-100 p-4 rounded text-red-800">
						<strong>Error:</strong>
						<pre>
							{results.wrapperError instanceof Error
								? results.wrapperError.message
								: String(results.wrapperError)}
						</pre>
					</div>
				) : (
					<div className="bg-green-100 p-4 rounded text-green-800">
						<strong>Success:</strong>
						<pre>{JSON.stringify(results.wrapper, null, 2)}</pre>
					</div>
				)}
			</div>
		</div>
	)
}
