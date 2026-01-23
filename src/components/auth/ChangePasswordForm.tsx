"use client";
import React, { useState } from "react";
import Label from "../form/Label";
import Input from "@/components/form/input/InputField";
import { useForm, useController } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import { useRouter } from "next/navigation";
import authentication from "@/app-api/authentication";

// Yup validation schema
const changePasswordSchema = yup.object({
	newPassword: yup
		.string()
		.min(8, "Password must be at least 8 characters")
		.matches(/[A-Z]/, "Password must contain at least one uppercase letter")
		.matches(/\d/, "Password must contain at least one number")
		.required("New password is required"),
	confirmPassword: yup
		.string()
		.oneOf([yup.ref("newPassword")], "Passwords must match")
		.required("Please confirm your password"),
});

type ChangePasswordFormData = yup.InferType<typeof changePasswordSchema>;

export default function ChangePasswordForm() {
	const [isLoading, setIsLoading] = useState(false);
	const [successMessage, setSuccessMessage] = useState<string>("");
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const router = useRouter();

	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<ChangePasswordFormData>({
		resolver: yupResolver(changePasswordSchema),
		mode: "onChange",
	});

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

	const onSubmit = async (data: ChangePasswordFormData) => {
		setIsLoading(true);
		setSuccessMessage("");
		setErrorMessage("");

		try {
			const result = await authentication.changePassword({
				newPassword: data.newPassword,
			});

			if (result.success) {
				setSuccessMessage("Password successfully changed!");
				setErrorMessage("");
				setTimeout(() => {
					router.push("/profile");
				}, 1500);
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
		<div className="w-full">
			<div className="mx-auto w-full max-w-md">
				<div className="mb-5 sm:mb-8">
					<h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
						Enter new password
					</h1>
				</div>

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
								<p className="text-sm text-red-500 mt-1">{errors.newPassword.message}</p>
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
								{isLoading ? "Changing..." : "Change password"}
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
			</div>
		</div>
	);
}

