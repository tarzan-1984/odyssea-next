import { Metadata } from "next";

export const metadata: Metadata = {
	title: "DAT Load Export Privacy Policy",
	description: "DAT Load Export Privacy Policy",
};

export default function ExtensionPrivacyPolicyPage() {
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
			<header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
				<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
					<h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">DAT LOAD EXPORT PRIVACY POLICY</h1>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
				<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
					<p className="mb-10 leading-relaxed text-gray-600 dark:text-gray-400">
						<strong>Last updated:</strong> September 6, 2026
					</p>

					<section className="mb-10">
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							DAT Load Export is an internal browser extension developed for authorized users of Odysseia, Inc. The extension is intended to streamline internal load processing while users work with DAT One.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">INFORMATION PROCESSED</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							The extension may access load and broker-related information displayed within DAT One, including information such as origin, destination, dates, mileage, weight, commodity details, rates, and broker information, as necessary to provide its functionality.
						</p>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							The extension may also process information required for user authentication and communication with Odysseia&apos;s authorized backend services.
						</p>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							The extension may process the user&apos;s verified email address when the user connects a Google account through Google OAuth. It may also process authentication information, including authentication tokens, as necessary to authenticate authorized users and maintain access to the extension&apos;s internal functionality.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">HOW INFORMATION IS USED</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							Information accessed by the extension is used solely to provide its stated functionality, including processing and exporting load information, supporting internal workflows, and retrieving relevant broker information.
						</p>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							Data is not sold, used for advertising, or used to determine creditworthiness or for lending purposes.
						</p>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							Authentication information and verified email addresses are used solely to authenticate authorized users, connect the intended Google account, and provide the extension&apos;s internal functionality. This information is not used for advertising, profiling, creditworthiness, or unrelated purposes.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">DATA SHARING</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							The extension communicates only with services required for its functionality, including Odysseia&apos;s authorized backend services and other services identified within the extension for internal load and broker processing.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">LOCAL STORAGE</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							The extension may use Chrome storage to retain settings and operational information necessary for its functionality.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">ACCESS</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							DAT Load Export is intended exclusively for authorized company users. The extension does not provide or bypass access to DAT One. Users must independently authenticate with DAT One using their authorized credentials.
						</p>
					</section>

					<section>
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">CONTACT</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							For questions regarding this Privacy Policy or DAT Load Export, contact:
						</p>
						<p className="mt-3 whitespace-pre-line leading-relaxed text-gray-600 dark:text-gray-400">
							Odysseia, Inc.
							{"\n"}Email: <a className="text-blue-600 underline" href="mailto:operations@odysseia.one">operations@odysseia.one</a>
						</p>
					</section>
				</div>
			</main>
		</div>
	);
}
