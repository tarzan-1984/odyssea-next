"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { clientAuth } from "@/utils/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useController } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import authentication from "@/app-api/authentication";
import { tokenEncoder } from "@/utils/tokenEncoder";

// Yup validation schema
const loginSchema = yup.object({
	email: yup.string().email("Please enter a valid email").required("Email is required"),
	password: yup
		.string()
		.min(6, "Password must be at least 6 characters")
		.required("Password is required"),
});

type LoginFormData = yup.InferType<typeof loginSchema>;

export default function SignInForm() {
	const [showPassword, setShowPassword] = useState(false);
	const [isChecked, setIsChecked] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [successMessage, setSuccessMessage] = useState<string>("");

	const router = useRouter();
	const searchParams = useSearchParams();

	// Check for error parameter in URL (from Google OAuth callback)
	useEffect(() => {
		if (searchParams) {
			const errorParam = searchParams.get("error");
			if (errorParam) {
				setErrorMessage(decodeURIComponent(errorParam));
				// Clear the error from URL to prevent showing it again on refresh
				router.replace("/signin", { scroll: false });
			}
		}
	}, [searchParams, router]);

	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormData>({
		resolver: yupResolver(loginSchema),
		mode: "onChange",
	});

	const {
		field: { onChange: onEmailChange, value: emailValue },
	} = useController({
		name: "email",
		control,
		defaultValue: "",
	});

	const {
		field: { onChange: onPasswordChange, value: passwordValue },
	} = useController({
		name: "password",
		control,
		defaultValue: "",
	});

	const onSubmit = async (data: LoginFormData) => {
		setIsLoading(true);
		setErrorMessage(""); // Clear previous errors
		setSuccessMessage(""); // Clear previous success messages

		try {
			// Call login function
			const result = await authentication.login(data);

			if (result.success) {
				// Set success message from API response
				const successMsg = result.data?.data?.message || "Login successful!";
				setSuccessMessage(successMsg);
				setErrorMessage(""); // Clear any previous error messages

				// Set temporary login success cookie with encoded email
				const encodedEmail = tokenEncoder.encode(data.email);
				clientAuth.setLoginSuccess(encodedEmail);

				// Redirect to two-step-verification page
				router.push("/two-step-verification");
			} else {
				// Display error message from backend (including role-based restrictions)
				const errorMsg = result.error || "Login failed";
				setErrorMessage(errorMsg);
				setSuccessMessage(""); // Clear any previous success messages
			}
		} catch {
			setErrorMessage("Network error occurred");
			setSuccessMessage(""); // Clear any previous success messages
		} finally {
			setIsLoading(false);
		}
	};

	const frontendOriginLink =
		process.env.NODE_ENV === "development" ? process.env.NEXT_PUBLIC_LOCAL_DEV_URL : "";

	return (
		<div className="flex flex-col flex-1 lg:w-1/2 w-full">
			<div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
				<div>
					<div className="mb-5 sm:mb-8">
						<h1 className="mb-2 font-semibold text-center text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
							Sign In
						</h1>
						<p className="text-sm text-center text-gray-500 dark:text-gray-400">
							Enter your email and password to sign in!
						</p>
					</div>

					<div>
						<div className="flex justify-center">
							<a
								href={`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/auth/social-login?frontendUrl=${frontendOriginLink}`}
								className="inline-flex items-center justify-center gap-3 py-3 text-sm font-normal text-gray-700 transition-colors bg-gray-100 rounded-lg px-7 hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
							>
								<svg
									width="20"
									height="20"
									viewBox="0 0 20 20"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M18.7511 10.1944C18.7511 9.47495 18.6915 8.94995 18.5626 8.40552H10.1797V11.6527H15.1003C15.0011 12.4597 14.4654 13.675 13.2749 14.4916L13.2582 14.6003L15.9087 16.6126L16.0924 16.6305C17.7788 15.1041 18.7511 12.8583 18.7511 10.1944Z"
										fill="#4285F4"
									/>
									<path
										d="M10.1788 18.75C12.5895 18.75 14.6133 17.9722 16.0915 16.6305L13.274 14.4916C12.5201 15.0068 11.5081 15.3666 10.1788 15.3666C7.81773 15.3666 5.81379 13.8402 5.09944 11.7305L4.99473 11.7392L2.23868 13.8295L2.20264 13.9277C3.67087 16.786 6.68674 18.75 10.1788 18.75Z"
										fill="#34A853"
									/>
									<path
										d="M5.10014 11.7305C4.91165 11.186 4.80257 10.6027 4.80257 9.99992C4.80257 9.3971 4.91165 8.81379 5.09022 8.26935L5.08523 8.1534L2.29464 6.02954L2.20333 6.0721C1.5982 7.25823 1.25098 8.5902 1.25098 9.99992C1.25098 11.4096 1.5982 12.7415 2.20333 13.9277L5.10014 11.7305Z"
										fill="#FBBC05"
									/>
									<path
										d="M10.1789 4.63331C11.8554 4.63331 12.9864 5.34303 13.6312 5.93612L16.1511 3.525C14.6035 2.11528 12.5895 1.25 10.1789 1.25C6.68676 1.25 3.67088 3.21387 2.20264 6.07218L5.08953 8.26943C5.81381 6.15972 7.81776 4.63331 10.1789 4.63331Z"
										fill="#EB4335"
									/>
								</svg>
								Sign in with Google
							</a>
						</div>
						<div className="relative py-3 sm:py-5">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
							</div>
							<div className="relative flex justify-center text-sm">
								<span className="p-2 text-gray-400 bg-white dark:bg-gray-900 sm:px-5 sm:py-2">
									Or
								</span>
							</div>
						</div>
						<form onSubmit={handleSubmit(onSubmit)}>
							<div className="space-y-6">
								<div>
									<Label>
										Email <span className="text-error-500">*</span>{" "}
									</Label>
									<Input
										placeholder="info@gmail.com"
										name="email"
										defaultValue={emailValue}
										onChange={onEmailChange}
									/>
									{errors.email?.message && (
										<p className="text-sm text-red-500 mt-1">
											{errors.email.message}
										</p>
									)}
								</div>
								<div>
									<Label>
										Password <span className="text-error-500">*</span>{" "}
									</Label>
									<div className="relative">
										<Input
											type={showPassword ? "text" : "password"}
											placeholder="Enter your password"
											name="password"
											defaultValue={passwordValue}
											onChange={onPasswordChange}
										/>
										<span
											onClick={() => setShowPassword(!showPassword)}
											className="absolute z-40 -translate-y-1/2 cursor-pointer right-4 top-1/2"
										>
											{showPassword ? (
												<EyeIcon className="fill-gray-500 dark:fill-gray-400" />
											) : (
												<EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
											)}
										</span>
									</div>
									{errors.password?.message && (
										<p className="text-sm text-red-500 mt-1">
											{errors.password.message}
										</p>
									)}
								</div>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<Checkbox checked={isChecked} onChange={setIsChecked} />
										<span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
											Keep me logged in
										</span>
									</div>
									<Link
										href="/reset-password"
										className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
									>
										Forgot password?
									</Link>
								</div>
								<div>
									<Button
										type={"submit"}
										className="w-full"
										size="sm"
										disabled={isLoading}
									>
										{isLoading ? "Signing in..." : "Sign in"}
									</Button>

									{/* Display success message */}
									{successMessage && (
										<div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
											<p className="text-sm text-green-600 text-center">
												{successMessage}
											</p>
										</div>
									)}

									{/* Display error message */}
									{errorMessage && (
										<div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
											<p className="text-sm text-red-600 text-center">
												{errorMessage}
											</p>
										</div>
									)}
								</div>
							</div>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
}
