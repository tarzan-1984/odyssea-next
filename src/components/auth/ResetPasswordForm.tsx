"use client";
import React, { useState } from "react";
import Link from "next/link";
import Label from "../form/Label";
import Input from "@/components/form/input/InputField";
import { useForm, useController } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import authentication from "@/app-api/authentication";

// Yup validation schema
const resetPasswordSchema = yup.object({
	email: yup.string().email("Please enter a valid email").required("Email is required"),
});

type ResetPasswordFormData = yup.InferType<typeof resetPasswordSchema>;

export default function ResetPasswordForm() {
	const [isLoading, setIsLoading] = useState(false);
	const [successMessage, setSuccessMessage] = useState<string>("");
	const [errorMessage, setErrorMessage] = useState<string>("");

	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<ResetPasswordFormData>({
		resolver: yupResolver(resetPasswordSchema),
		mode: "onChange",
	});

	const {
		field: { onChange: onEmailChange, value: emailValue },
	} = useController({
		name: "email",
		control,
		defaultValue: "",
	});

	const onSubmit = async (data: ResetPasswordFormData) => {
		setIsLoading(true);
		setSuccessMessage("");
		setErrorMessage("");

		try {
			// Call forgotPassword function with validated email
			const result = await authentication.forgotPassword({ email: data.email });

			if (result.success) {
				setSuccessMessage(result.message || "Password reset email sent successfully!");
				setErrorMessage("");
			} else {
				setErrorMessage(result.error || "Failed to send password reset email");
				setSuccessMessage("");
			}
		} catch {
			setErrorMessage("Network error occurred");
			setSuccessMessage("");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex flex-col flex-1 lg:w-1/2 w-full">
			<div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
				<div className="mb-5 sm:mb-8">
					<h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
						Forgot Your Password?
					</h1>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Enter the email address linked to your account, and we&apos;ll send you a
						link to reset your password.
					</p>
				</div>
				<div>
					<form onSubmit={handleSubmit(onSubmit)}>
						<div className="space-y-5">
							{/* <!-- Email --> */}
							<div>
								<Label>
									Email<span className="text-error-500">*</span>
								</Label>
								<Input
									type="email"
									id="email"
									name="email"
									placeholder="Enter your email"
									defaultValue={emailValue}
									onChange={onEmailChange}
								/>
								{errors.email?.message && (
									<p className="text-sm text-red-500 mt-1">
										{errors.email.message}
									</p>
								)}
							</div>

							{/* <!-- Button --> */}
							<div>
								<button
									type="submit"
									className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600"
									disabled={isLoading}
								>
									{isLoading ? "Sending..." : "Send Reset Link"}
								</button>
							</div>
						</div>
					</form>

					{/* Display success message */}
					{successMessage && (
						<div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
							<p className="text-sm text-green-600 text-center">{successMessage}</p>
						</div>
					)}

					{/* Display error message */}
					{errorMessage && (
						<div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
							<p className="text-sm text-red-600 text-center">{errorMessage}</p>
						</div>
					)}

					<div className="mt-5">
						<p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
							Wait, I remember my password...
							<Link
								href="/"
								className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
							>
								Click here
							</Link>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
