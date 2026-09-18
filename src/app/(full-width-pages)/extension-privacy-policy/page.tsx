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
						<strong>Last updated:</strong> September 18, 2026
					</p>

					<section className="mb-10">
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							DAT Load Export is an internal browser extension developed for authorized users of Odysseia, Inc. The extension is intended to streamline internal load processing and related workflows while authorized users work with DAT One.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">INFORMATION PROCESSED</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							The extension may access load and broker-related information displayed within DAT One, including origin, destination, dates, mileage, weight, commodity details, rates, broker information, and other load-related content necessary to provide its functionality.
						</p>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							The extension may process the verified email address associated with a Google account when a user connects that account through Google OAuth.
						</p>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							The extension may also process authentication information, including authentication tokens, as necessary to authenticate authorized users, maintain authenticated sessions, and communicate securely with Odysseia&apos;s authorized backend services.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">HOW INFORMATION IS USED</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							Information processed by the extension is used solely to provide its stated functionality, including:
						</p>
						<ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed text-gray-600 dark:text-gray-400">
							<li>authenticating authorized users;</li>
							<li>identifying the Google account connected by the user;</li>
							<li>processing and exporting load information;</li>
							<li>supporting internal load and broker workflows;</li>
							<li>retrieving information required for internal broker and load processing; and</li>
							<li>maintaining extension settings and authenticated sessions.</li>
						</ul>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							User data is not sold, used for advertising, used for unrelated profiling, or used to determine creditworthiness or for lending purposes.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">GOOGLE ACCOUNT INFORMATION</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							When a user chooses to connect a Google account, DAT Load Export uses Google OAuth to authenticate the account and obtain the verified email address associated with it.
						</p>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							Google account information is used only for the extension&apos;s stated internal functionality and is not used for advertising or unrelated purposes.
						</p>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							The extension does not use Google OAuth to bypass Google account security or obtain access beyond the permissions authorized by the user.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">DATA SHARING</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							The extension communicates only with services necessary to provide its functionality, including Odysseia&apos;s authorized backend services, Google services required for Google OAuth and account identification, and services required for internal load and broker processing.
						</p>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							User data is not sold or transferred to third parties for advertising, marketing, creditworthiness, lending, or other purposes unrelated to the extension&apos;s stated functionality.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">LOCAL STORAGE</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							The extension may use Chrome storage to retain settings, operational preferences, authentication-related information, and other information necessary for its functionality and to maintain the user&apos;s session between browser sessions.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">DATA SECURITY</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							Odysseia takes reasonable measures to protect information processed by the extension and limits access to systems and information used by DAT Load Export to authorized users and services.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">ACCESS</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							DAT Load Export is intended exclusively for authorized company users.
						</p>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							The extension does not provide, bypass, or modify access to DAT One. Users must independently authenticate with DAT One using credentials authorized for their use.
						</p>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							Access to Odysseia-specific functionality may also require authentication through Odysseia&apos;s authorized systems.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">USER CHOICE AND ACCESS</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							Users may disconnect a connected Google account or stop using the extension. Access to the extension may also be managed centrally by Odysseia through its organizational browser and account management policies.
						</p>
					</section>

					<section className="mb-10">
						<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">CHANGES TO THIS PRIVACY POLICY</h2>
						<p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
							This Privacy Policy may be updated when the functionality of DAT Load Export or its data practices change. The &ldquo;Last updated&rdquo; date at the top of this policy indicates the most recent revision.
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
