"use client";
import Link from "next/link";
import React, { useRef, useState, useEffect } from "react";
import Label from "@/components/form/Label";
import { useRouter } from "next/navigation";
import authentication from "@/app-api/authentication";
import { clientAuth } from "@/utils/auth";
import { tokenEncoder } from "@/utils/tokenEncoder";

export default function OtpForm() {
	const [otp, setOtp] = useState(["", "", "", "", "", ""]);
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
		null
	);
	const [email, setEmail] = useState<string>("");
	const inputsRef = useRef<HTMLInputElement[]>([]);

	const router = useRouter();

	// Get email from login success cookie when component mounts
	useEffect(() => {
		// Check if user has login success cookie
		const encodedEmail = clientAuth.getLoginSuccess();
		if (!encodedEmail) {
			// No login success cookie, redirect back to signin
			setMessage({ type: "error", text: "Please login first to access this page" });
			router.push("/signin");
			return;
		}

		try {
			// Decode email from cookie
			const decodedEmail = tokenEncoder.decode(encodedEmail);
			setEmail(decodedEmail);
		} catch (error) {
			console.error("Error decoding email from cookie:", error);
			// Invalid encoded email, redirect back to signin
			setMessage({ type: "error", text: "Invalid session data. Please login again" });
			router.push("/signin");
		}
	}, [router]);

	const handleChange = (value: string, index: number) => {
		const updatedOtp = [...otp];
		updatedOtp[index] = value;

		// Update the state with the new value
		setOtp(updatedOtp);

		// Automatically move to the next input if a value is entered
		if (value && index < inputsRef.current.length - 1) {
			inputsRef.current[index + 1].focus();
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
		if (event.key === "Backspace") {
			const updatedOtp = [...otp];

			// If current input is empty, move focus to the previous input
			if (!otp[index] && index > 0) {
				inputsRef.current[index - 1].focus();
			}

			// Clear the current input
			updatedOtp[index] = "";
			setOtp(updatedOtp);
		}

		if (event.key === "ArrowLeft" && index > 0) {
			inputsRef.current[index - 1].focus();
		}

		if (event.key === "ArrowRight" && index < inputsRef.current.length - 1) {
			inputsRef.current[index + 1].focus();
		}
	};

	const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
		event.preventDefault();

		// Get the pasted text
		const pasteData = event.clipboardData.getData("text").slice(0, 6).split("");

		// Update OTP with the pasted data
		const updatedOtp = [...otp];
		pasteData.forEach((char, idx) => {
			if (idx < updatedOtp.length) {
				updatedOtp[idx] = char;
			}
		});

		setOtp(updatedOtp);

		// Focus the last filled input
		const filledIndex = pasteData.length - 1;
		if (inputsRef.current[filledIndex]) {
			inputsRef.current[filledIndex].focus();
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const otpCode = otp.join("");
		if (otpCode.length !== 6) {
			setMessage({ type: "error", text: "Please enter a 6-digit OTP code" });
			return;
		}

		setIsLoading(true);
		setMessage(null);

		try {
			if (!email) {
				setMessage({
					type: "error",
					text: "Email not found. Please go back and try again.",
				});
				return;
			}

			const result = await authentication.verifyOTP({ email, otp: otpCode });

			if (result.success) {
				setMessage({ type: "success", text: "OTP verified successfully!" });

				// Extract user data and tokens from response
				const { accessToken, refreshToken, user: userData } = result.data?.data || {};

				if (accessToken && refreshToken && userData) {
					// Transform UserData from API format to client format
					const clientUserData = {
						id: userData.id || "",
						email: userData.email || "",
						firstName: userData.firstName || "",
						lastName: userData.lastName || "",
						role: userData.role || "",
						status: userData.status || "",
						avatar: userData.avatar || "",
						externalId: userData.externalId || "",
						phone: userData.phone || "",
						location: userData.location || "",
					};

					// Save user data to cookies (tokens are already set by API route)
					clientAuth.setUserData(clientUserData);

					// Also save access token to localStorage for ChatApi
					if (typeof window !== "undefined") {
						localStorage.setItem("authToken", accessToken);
					}

					// Remove temporary login success cookie
					clientAuth.removeLoginSuccess();

					// Force page reload to ensure middleware sees the new cookies
					// This is especially important on Vercel where middleware might not see cookies immediately
					if (typeof window !== "undefined") {
						window.location.href = "/";
					} else {
						router.push("/");
					}
				} else {
					setMessage({
						type: "error",
						text: "Authentication data not received from server",
					});
				}
			} else {
				setMessage({ type: "error", text: result.error || "OTP verification failed" });
			}
		} catch (error) {
			console.error("Error during OTP verification:", error);
			setMessage({ type: "error", text: "Network error occurred" });
		} finally {
			setIsLoading(false);
		}
	};
	return (
		<div className="flex flex-col flex-1 lg:w-1/2 w-full">
			<div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
				<div className="mb-5 sm:mb-8">
					<h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
						Two Step Verification
					</h1>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						A verification code has been sent to{" "}
						<span className="font-medium text-gray-700 dark:text-gray-300">
							{email || "your email"}
						</span>
						. Please enter it in the field below.
					</p>
				</div>
				<div>
					<form>
						<div className="space-y-5">
							{/* <!-- Email --> */}
							<div>
								<Label>Type your 6 digits security code</Label>
								<div className="flex gap-2 sm:gap-4" id="otp-container">
									{otp.map((_, index) => (
										<input
											key={index}
											type="text"
											maxLength={1}
											value={otp[index]}
											onChange={e => handleChange(e.target.value, index)}
											onKeyDown={e => handleKeyDown(e, index)}
											onPaste={e => handlePaste(e)}
											// ref={(el) => (inputsRef.current[index] = el!)} // Assign input refs
											ref={el => {
												if (el) {
													inputsRef.current[index] = el;
												}
											}}
											className="dark:bg-dark-900 otp-input h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-center text-xl font-semibold text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
										/>
									))}
								</div>
							</div>

							{/* <!-- Button --> */}
							<div>
								<button
									onClick={handleSubmit}
									disabled={isLoading}
									className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isLoading ? "Verifying..." : "Verify My Account"}
								</button>

								{/* Display messages */}
								{message && (
									<div
										className={`mt-3 p-3 rounded-lg border ${
											message.type === "success"
												? "bg-green-50 border-green-200"
												: "bg-red-50 border-red-200"
										}`}
									>
										<p
											className={`text-sm text-center ${
												message.type === "success"
													? "text-green-600"
													: "text-red-600"
											}`}
										>
											{message.text}
										</p>
									</div>
								)}
							</div>
						</div>
					</form>
					<div className="mt-5">
						<p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
							Didn’t get the code?{" "}
							<Link
								href="/"
								className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
							>
								Resend
							</Link>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
