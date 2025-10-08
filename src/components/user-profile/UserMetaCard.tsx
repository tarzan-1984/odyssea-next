"use client";
import React, { useState, useEffect } from "react";
import Button from "../ui/button/Button";
import Image from "next/image";
import { Camera } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import UploadFile from "@/components/upload-file/UploadFile";
import { useCurrentUser, useUpdateUserField } from "@/stores/userStore";
import { renderAvatar } from "@/helpers";
import { clientAuth } from "@/utils/auth";
import {UserData} from "@/app-api/api-types";
import { S3Uploader } from "@/app-api/S3Uploader";

interface IFormDataImportTable {
	upload: File | null;
}

interface IUserMetaCardProp {
	user: UserData | null;
}

export default function UserMetaCard({user}: IUserMetaCardProp) {
	const currentUser = useCurrentUser();
	// Get user data from Zustand store
	const updateUserField = useUpdateUserField();

	// State for upload handling
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	// Cleanup preview URL on component unmount
	useEffect(() => {
		return () => {
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
		};
	}, [previewUrl]);

	// Handle file selection
	const handleFileSelect = (file: File | null) => {
		setSelectedFile(file);
		setUploadError(null);

		if (file) {
			// Create preview URL
			const url = URL.createObjectURL(file);
			setPreviewUrl(url);
		} else {
			// Clear preview
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
			setPreviewUrl(null);
		}
	};

	// Handle avatar upload
	const handleAvatarUpload = async (file: File) => {
		if (!file || !user?.id) return;

		setIsUploading(true);
		setUploadError(null);

		try {
			// Step 1: Upload file to S3 cloud storage
			const uploader = new S3Uploader();
			const timestamp = Math.floor(Date.now() / 1000);
			const extension = file.name.split('.').pop() || 'jpg';
			const fileName = `avatar-user_${user.id}_${timestamp}.${extension}`;
			
			const { fileUrl } = await uploader.upload(new File([file], fileName, { type: file.type }));

			// Step 2: Update user profile with new avatar URL
			const updateResponse = await fetch("/api/users/update-avatar", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					avatarUrl: fileUrl,
				}),
			});

			const updateData = await updateResponse.json();

			if (!updateResponse.ok) {
				throw new Error(updateData.error || "Failed to update avatar");
			}

			if(user.id === currentUser?.id) {
				// Step 3: Update local state (Zustand)
				updateUserField("avatar", fileUrl);

				// Step 4: Update cookies with new avatar URL
				if (user) {
					const updatedUserData = {
						id: user.id,
						email: user.email,
						firstName: user.firstName,
						lastName: user.lastName,
						role: user.role,
						status: user.status,
						avatar: fileUrl, // Update avatar in cookies
						externalId: user.externalId || "",
						phone: user.phone || "",
						location: user.location || "",
					};
					clientAuth.setUserData(updatedUserData);
				}
			}

			// Step 5: Clear preview and selected file
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
			setPreviewUrl(null);
			setSelectedFile(null);
			reset(); // Clear form

			console.log("Avatar updated successfully!");
		} catch (error) {
			console.error("Error uploading avatar:", error);
			setUploadError(error instanceof Error ? error.message : "Upload failed");
		} finally {
			setIsUploading(false);
		}
	};

	const {
		control,
		handleSubmit,
		reset,
		// watch
	} = useForm<IFormDataImportTable>({
		defaultValues: {
			upload: null,
		},
	});

	const onSubmit = async (data: IFormDataImportTable) => {
		if (data.upload) {
			await handleAvatarUpload(data.upload);
		}
	};

	if(!user) {
		return (<></>);
	}

	return (
		<>
			<div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
				<div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
					<div className="flex flex-col items-center w-full gap-6 xl:flex-row justify-between">
						<div className="flex flex-col items-center w-full gap-6 xl:flex-row">
							<div className="flex flex-col items-center gap-3">
								<form
									onSubmit={handleSubmit(onSubmit)}
									className="overflow-hidden relative group rounded-full"
								>
									{/* Show preview if file selected, otherwise show current avatar */}
									{previewUrl ? (
										<Image
											src={previewUrl}
											alt="Preview"
											width={20}
											height={20}
											className="w-20 h-20 rounded-full object-cover"
										/>
									) : (
										user && renderAvatar(user, "w-20 h-20")
									)}

									<Controller
										name="upload"
										control={control}
										render={({ field }) => (
											<UploadFile
												value={field.value}
												onChange={file => {
													if (!isUploading) {
														field.onChange(file);
														handleFileSelect(file);
													}
												}}
												className={`absolute top-0 left-0 w-full h-full bg-red z-1 hidden group-hover:flex items-center justify-center bg-gray-900/25 cursor-pointer ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
												allowedTypes={[
													"image/jpeg",
													"image/jpg",
													"image/png",
													"image/gif",
													"image/webp",
												]}
											>
												{isUploading ? (
													<div className="text-white text-xs">
														Uploading...
													</div>
												) : (
													<Camera size={16} className="text-white" />
												)}
											</UploadFile>
										)}
									/>
								</form>

								{/* Save/Cancel buttons when file is selected */}
								{selectedFile && !isUploading && (
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											className="h-8 px-3 text-xs"
											onClick={() => {
												setSelectedFile(null);
												if (previewUrl) {
													URL.revokeObjectURL(previewUrl);
												}
												setPreviewUrl(null);
												reset();
											}}
										>
											Cancel
										</Button>
										<Button
											variant="primary"
											size="sm"
											className="h-8 px-3 text-xs"
											onClick={() => handleAvatarUpload(selectedFile)}
										>
											Save Avatar
										</Button>
									</div>
								)}

								{/* Error message */}
								{uploadError && (
									<div className="text-sm text-red-500 text-center">
										{uploadError}
									</div>
								)}
							</div>

							<div>
								<h4 className="mb-2 text-lg font-semibold text-center text-gray-800 dark:text-white/90 xl:text-left">
									{(user?.firstName || user?.lastName) &&
										`${user.firstName} ${user.lastName}`}
								</h4>
								<div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
									<p className="text-sm text-gray-500 dark:text-gray-400">
										{user?.role || "-"}
									</p>
									<div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
									<p className="text-sm text-gray-500 dark:text-gray-400">
										{user?.status || "-"}
									</p>
								</div>
							</div>
						</div>

						{user.role === 'DRIVER' &&
							<div className="shrink-0">
								<h4 className="mb-2 text-lg font-semibold text-center text-gray-800 dark:text-white/90 xl:text-left">
									Recruiter Manager
								</h4>
								<p className="text-sm text-gray-500 dark:text-gray-400">Alex Baker</p>
							</div>
						}
					</div>
				</div>
			</div>
		</>
	);
}
