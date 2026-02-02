import { Metadata } from "next";

export const metadata: Metadata = {
	title: "Privacy Policy - Odysseia",
	description: "Privacy Policy for Odysseia application",
};

const sectionTitle = "mb-3 text-lg font-semibold text-gray-900 dark:text-white";
const sectionText = "text-gray-600 dark:text-gray-400 leading-relaxed";
const listItem = "ml-4 mt-1 text-gray-600 dark:text-gray-400 leading-relaxed";

export default function PrivacyPolicyPage() {
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
			{/* Header */}
			<header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
				<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
					<h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
						Privacy Policy
					</h1>
					<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Odysseia App · Last updated: {new Date().toLocaleDateString("en-US")}
					</p>
				</div>
			</header>

			{/* Content */}
			<main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
				<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
					<p className={`${sectionText} mb-8`}>
						Odysseia Inc. (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates
						the Odysseia App, a mobile application for carrier teams that provides
						real-time location tracking, communication, and operational tools. This
						Privacy Policy describes how we collect, use, store, and protect your
						information when you use our application and related services.
					</p>

					<section className="mb-10">
						<h2 className={sectionTitle}>1. Information We Collect</h2>
						<p className={sectionText}>
							We collect the following categories of information:
						</p>
						<ul className="mt-3 list-disc space-y-2 pl-6">
							<li className={listItem}>
								<strong className="text-gray-800 dark:text-gray-300">
									Account information:
								</strong>{" "}
								Email address, password (stored in encrypted form), first and last
								name, phone number, role (e.g., driver, dispatcher), and company
								affiliation.
							</li>
							<li className={listItem}>
								<strong className="text-gray-800 dark:text-gray-300">
									Location data:
								</strong>{" "}
								Precise GPS coordinates when you use the app. For drivers, we
								collect location in the background to share your position with
								dispatchers on the map. Location sharing can be enabled or disabled
								in app settings.
							</li>
							<li className={listItem}>
								<strong className="text-gray-800 dark:text-gray-300">
									Profile photo:
								</strong>{" "}
								If you choose to set an avatar, we access your device&apos;s photo
								library to let you select an image. The photo is uploaded to our
								servers and displayed to other users in your organization (e.g., in
								chat and contacts).
							</li>
							<li className={listItem}>
								<strong className="text-gray-800 dark:text-gray-300">
									Chat and messaging:
								</strong>{" "}
								Text messages, file attachments, and related metadata sent through
								the in-app chat. Messages are stored on our servers and visible to
								participants in the conversation.
							</li>
							<li className={listItem}>
								<strong className="text-gray-800 dark:text-gray-300">
									Device and app usage:
								</strong>{" "}
								Device identifiers for push notifications, app version, and basic
								usage data to support functionality and troubleshoot issues.
							</li>
						</ul>
					</section>

					<section className="mb-10">
						<h2 className={sectionTitle}>2. How We Use Your Information</h2>
						<p className={sectionText}>We use the information we collect to:</p>
						<ul className="mt-3 list-disc space-y-2 pl-6">
							<li className={listItem}>
								Provide and operate the app (authentication, chat, location sharing,
								notifications).
							</li>
							<li className={listItem}>
								Display driver locations on the map for dispatchers and other
								authorized users within your organization.
							</li>
							<li className={listItem}>
								Enable direct and group messaging between drivers, dispatchers, and
								office staff.
							</li>
							<li className={listItem}>
								Send push notifications (e.g., new messages, status updates).
							</li>
							<li className={listItem}>
								Maintain and improve our services, fix issues, and comply with legal
								obligations.
							</li>
						</ul>
					</section>

					<section className="mb-10">
						<h2 className={sectionTitle}>3. Who Has Access to Your Data</h2>
						<p className={sectionText}>
							Access to your data depends on your role and our app&apos;s
							functionality:
						</p>
						<ul className="mt-3 list-disc space-y-2 pl-6">
							<li className={listItem}>
								<strong className="text-gray-800 dark:text-gray-300">
									Drivers:
								</strong>{" "}
								Your location, status, name, phone, and profile photo may be visible
								to dispatchers and other authorized users in your company. Your
								phone number may be displayed so they can contact you.
							</li>
							<li className={listItem}>
								<strong className="text-gray-800 dark:text-gray-300">
									Dispatchers / office staff:
								</strong>{" "}
								You can view driver locations on the map and communicate via chat.
								Your profile and contact details may be visible to other users in
								your organization.
							</li>
							<li className={listItem}>
								<strong className="text-gray-800 dark:text-gray-300">
									Third parties:
								</strong>{" "}
								We do not sell your personal information. We may share data with
								service providers (e.g., cloud hosting, push notification services)
								who assist in operating the app, under strict confidentiality
								agreements.
							</li>
						</ul>
					</section>

					<section className="mb-10">
						<h2 className={sectionTitle}>4. Data Storage and Security</h2>
						<p className={sectionText}>
							Your data is stored on secure servers with industry-standard
							protections. We use encryption for data in transit (TLS/HTTPS) and
							appropriate safeguards to protect against unauthorized access,
							alteration, or destruction. Chat messages and location data are cached
							locally on your device for offline access and faster loading; you can
							clear app data in your device settings.
						</p>
					</section>

					<section className="mb-10">
						<h2 className={sectionTitle}>5. Data Retention</h2>
						<p className={sectionText}>
							We retain your account and chat data for as long as your account is
							active and as needed to provide our services. Location history may be
							retained for a limited period to support map and tracking features. When
							you delete your account or request deletion, we will remove or anonymize
							your personal data in accordance with our retention policies and
							applicable law.
						</p>
					</section>

					<section className="mb-10">
						<h2 className={sectionTitle}>6. Your Rights and Choices</h2>
						<p className={sectionText}>
							Depending on your location, you may have the right to:
						</p>
						<ul className="mt-3 list-disc space-y-2 pl-6">
							<li className={listItem}>Access and receive a copy of your data.</li>
							<li className={listItem}>Correct inaccurate personal information.</li>
							<li className={listItem}>Request deletion of your personal data.</li>
							<li className={listItem}>Object to or restrict certain processing.</li>
							<li className={listItem}>
								Withdraw consent where processing is based on consent.
							</li>
						</ul>
						<p className={`${sectionText} mt-4`}>
							You can control location sharing in the app settings. To exercise your
							rights or ask questions about your data, contact your
							organization&apos;s administrator or reach out to us using the contact
							details below.
						</p>
					</section>

					<section className="mb-10">
						<h2 className={sectionTitle}>7. Children&apos;s Privacy</h2>
						<p className={sectionText}>
							Odysseia App is intended for use by carrier team members in a
							professional context. We do not knowingly collect personal information
							from children under 13 (or the applicable age in your jurisdiction). If
							you believe we have collected such information, please contact us so we
							can delete it.
						</p>
					</section>

					<section className="mb-10">
						<h2 className={sectionTitle}>8. Changes to This Policy</h2>
						<p className={sectionText}>
							We may update this Privacy Policy from time to time. We will notify you
							of material changes by posting the updated policy in the app or on our
							website and updating the &quot;Last updated&quot; date. Your continued
							use of the app after changes constitutes acceptance of the revised
							policy.
						</p>
					</section>

					<section className="mb-8">
						<h2 className={sectionTitle}>9. Contact Us</h2>
						<p className={sectionText}>
							If you have questions about this Privacy Policy or our data practices,
							please contact Odysseia Inc. through your organization&apos;s support
							channel or at the contact information provided by your employer.
						</p>
					</section>
				</div>
			</main>
		</div>
	);
}
