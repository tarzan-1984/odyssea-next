"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Label from "../form/Label";
import Input from "@/components/form/input/InputField";
import { useForm, useController } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import { useRouter, useSearchParams } from "next/navigation";
import authentication from "@/app-api/authentication";

// Yup validation schema
const newPasswordSchema = yup.object({
	newPassword: yup
		.string()
		.min(6, "Password must be at least 6 characters")
		.required("New password is required"),
	confirmPassword: yup
		.string()
		.oneOf([yup.ref("newPassword")], "Passwords must match")
		.required("Please confirm your password"),
});

type NewPasswordFormData = yup.InferType<typeof newPasswordSchema>;

export default function NewPasswordForm() {
	const [isLoading, setIsLoading] = useState(false);
	const [successMessage, setSuccessMessage] = useState<string>("");
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<NewPasswordFormData>({
		resolver: yupResolver(newPasswordSchema),
		mode: "onChange",
	});

	// Check if token exists on component mount
	useEffect(() => {
		if (!token) {
			setErrorMessage("Reset token is missing. Please use the link from your email.");
		}
	}, [token]);

	const {
		field: { onChange: onNewPasswordChange, value: newPasswordValue },
	} = useController({
		name: "newPassword",
		control,
		defaultValue: "",
	});

	const {
		field: { onChange: onConfirmPasswordChange, value: confirmPasswordValue },
	} = useController({
		name: "confirmPassword",
		control,
		defaultValue: "",
	});

	const onSubmit = async (data: NewPasswordFormData) => {
		setIsLoading(true);
		setSuccessMessage("");
		setErrorMessage("");

		if (!token) {
			setErrorMessage("Reset token is missing");
			setIsLoading(false);
			return;
		}

		try {
			// Call resetPassword function with token and new password
			const result = await authentication.resetPassword({
				token: token,
				newPassword: data.newPassword,
			});

			if (result.success) {
				setSuccessMessage("Password successfully changed!");
				setErrorMessage("");

				// Redirect to login page after successful password reset
				setTimeout(() => {
					router.push("/signin");
				}, 2000);
			} else {
				setErrorMessage(result.error || "Failed to change password");
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
						Reset Password
					</h1>
					<p className="text-sm text-gray-500 dark:text-gray-400">Enter new password</p>
				</div>
				<div>
					<form onSubmit={handleSubmit(onSubmit)}>
						<div className="space-y-5">
							{/* New Password */}
							<div>
								<Label>
									New Password<span className="text-error-500">*</span>
								</Label>
								<div className="relative">
									<Input
										type={showNewPassword ? "text" : "password"}
										id="newPassword"
										name="newPassword"
										placeholder="Enter new password"
										defaultValue={newPasswordValue}
										onChange={onNewPasswordChange}
									/>
									<span
										onClick={() => setShowNewPassword(!showNewPassword)}
										className="absolute z-40 -translate-y-1/2 cursor-pointer right-4 top-1/2"
									>
										{showNewPassword ? (
											<EyeIcon className="fill-gray-500 dark:fill-gray-400" />
										) : (
											<EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
										)}
									</span>
								</div>
								{errors.newPassword?.message && (
									<p className="text-sm text-red-500 mt-1">
										{errors.newPassword.message}
									</p>
								)}
							</div>

							{/* Confirm Password */}
							<div>
								<Label>
									Confirm Password<span className="text-error-500">*</span>
								</Label>
								<div className="relative">
									<Input
										type={showConfirmPassword ? "text" : "password"}
										id="confirmPassword"
										name="confirmPassword"
										placeholder="Confirm new password"
										defaultValue={confirmPasswordValue}
										onChange={onConfirmPasswordChange}
									/>
									<span
										onClick={() => setShowConfirmPassword(!showConfirmPassword)}
										className="absolute z-40 -translate-y-1/2 cursor-pointer right-4 top-1/2"
									>
										{showConfirmPassword ? (
											<EyeIcon className="fill-gray-500 dark:fill-gray-400" />
										) : (
											<EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
										)}
									</span>
								</div>
								{errors.confirmPassword?.message && (
									<p className="text-sm text-red-500 mt-1">
										{errors.confirmPassword.message}
									</p>
								)}
							</div>

							{/* Button */}
							<div>
								<button
									type="submit"
									className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600"
									disabled={isLoading}
								>
									{isLoading ? "Changing..." : "Change Password"}
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
							Remember your password?
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
