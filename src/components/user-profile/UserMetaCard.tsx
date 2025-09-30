"use client";
import React, { useState, useEffect } from "react";
import { useModal } from "../../hooks/useModal";
// import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
// import Input from "../form/input/InputField";
// import Label from "../form/Label";
import Image from "next/image";
import { Camera } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import UploadFile from "@/components/upload-file/UploadFile";
import { useCurrentUser, useUpdateUserField, useUserStore } from "@/stores/userStore";
import { renderAvatar } from "@/helpers";
import { clientAuth } from "@/utils/auth";

interface IFormDataImportTable {
	upload: File | null;
}

export default function UserMetaCard() {
	// Get user data from Zustand store
	const currentUser = useCurrentUser();
	const updateUserField = useUpdateUserField();

	// State for upload handling
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	// const { isOpen, openModal, closeModal } = useModal();
	const { isOpen, closeModal } = useModal();

	// Cleanup preview URL on component unmount
	useEffect(() => {
		return () => {
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
		};
	}, [previewUrl]);

	const handleSave = () => {
		// Handle save logic here
		console.log("Saving changes...");
		closeModal();
	};

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
		if (!file || !currentUser?.id) return;

		setIsUploading(true);
		setUploadError(null);

		try {
			// Step 1: Upload file to server
			const formData = new FormData();
			formData.append("file", file);
			formData.append("userId", currentUser.id);

			const uploadResponse = await fetch("/api/upload/avatar", {
				method: "POST",
				body: formData,
			});

			const uploadData = await uploadResponse.json();

			if (!uploadResponse.ok) {
				throw new Error(uploadData.error || "Upload failed");
			}

			// Step 2: Update user profile with new avatar URL
			const updateResponse = await fetch("/api/users/update-avatar", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					avatarUrl: uploadData.avatarUrl,
				}),
			});

			const updateData = await updateResponse.json();

			if (!updateResponse.ok) {
				throw new Error(updateData.error || "Failed to update avatar");
			}

			// Step 3: Update local state (Zustand)
			updateUserField("avatar", uploadData.avatarUrl);

			// Step 4: Update cookies with new avatar URL
			if (currentUser) {
				const updatedUserData = {
					id: currentUser.id,
					email: currentUser.email,
					firstName: currentUser.firstName,
					lastName: currentUser.lastName,
					role: currentUser.role,
					status: currentUser.status,
					avatar: uploadData.avatarUrl, // Update avatar in cookies
				};
				clientAuth.setUserData(updatedUserData);
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
										currentUser && renderAvatar(currentUser, "w-20 h-20")
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
									{(currentUser?.firstName || currentUser?.lastName) &&
										`${currentUser.firstName} ${currentUser.lastName}`}
								</h4>
								<div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
									<p className="text-sm text-gray-500 dark:text-gray-400">
										{currentUser?.role || "-"}
									</p>
									<div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
									<p className="text-sm text-gray-500 dark:text-gray-400">
										{currentUser?.status || "-"}
									</p>
								</div>
							</div>
						</div>

						<div className="shrink-0">
							<h4 className="mb-2 text-lg font-semibold text-center text-gray-800 dark:text-white/90 xl:text-left">
								Recruiter Manager
							</h4>
							<p className="text-sm text-gray-500 dark:text-gray-400">Alex Baker</p>
						</div>
					</div>
				</div>
			</div>
			{/*<Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">*/}
			{/*	<div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">*/}
			{/*		<div className="px-2 pr-14">*/}
			{/*			<h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">*/}
			{/*				Edit Personal Information*/}
			{/*			</h4>*/}
			{/*			<p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">*/}
			{/*				Update your details to keep your profile up-to-date.*/}
			{/*			</p>*/}
			{/*		</div>*/}
			{/*		<form className="flex flex-col">*/}
			{/*			<div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">*/}
			{/*				<div>*/}
			{/*					<h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">*/}
			{/*						Social Links*/}
			{/*					</h5>*/}

			{/*					<div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">*/}
			{/*						<div>*/}
			{/*							<Label>Facebook</Label>*/}
			{/*							<Input*/}
			{/*								type="text"*/}
			{/*								defaultValue="https://www.facebook.com/PimjoHQ"*/}
			{/*							/>*/}
			{/*						</div>*/}

			{/*						<div>*/}
			{/*							<Label>X.com</Label>*/}
			{/*							<Input type="text" defaultValue="https://x.com/PimjoHQ" />*/}
			{/*						</div>*/}

			{/*						<div>*/}
			{/*							<Label>Linkedin</Label>*/}
			{/*							<Input*/}
			{/*								type="text"*/}
			{/*								defaultValue="https://www.linkedin.com/company/pimjo"*/}
			{/*							/>*/}
			{/*						</div>*/}

			{/*						<div>*/}
			{/*							<Label>Instagram</Label>*/}
			{/*							<Input*/}
			{/*								type="text"*/}
			{/*								defaultValue="https://instagram.com/PimjoHQ"*/}
			{/*							/>*/}
			{/*						</div>*/}
			{/*					</div>*/}
			{/*				</div>*/}
			{/*				<div className="mt-7">*/}
			{/*					<h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">*/}
			{/*						Personal Information*/}
			{/*					</h5>*/}

			{/*					<div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">*/}
			{/*						<div className="col-span-2 lg:col-span-1">*/}
			{/*							<Label>First Name</Label>*/}
			{/*							<Input*/}
			{/*								type="text"*/}
			{/*								defaultValue={currentUser?.firstName || ""}*/}
			{/*								onChange={e =>*/}
			{/*									updateUserField("firstName", e.target.value)*/}
			{/*								}*/}
			{/*							/>*/}
			{/*						</div>*/}

			{/*						<div className="col-span-2 lg:col-span-1">*/}
			{/*							<Label>Last Name</Label>*/}
			{/*							<Input*/}
			{/*								type="text"*/}
			{/*								defaultValue={currentUser?.lastName || ""}*/}
			{/*								onChange={e =>*/}
			{/*									updateUserField("lastName", e.target.value)*/}
			{/*								}*/}
			{/*							/>*/}
			{/*						</div>*/}

			{/*						<div className="col-span-2 lg:col-span-1">*/}
			{/*							<Label>Email Address</Label>*/}
			{/*							<Input*/}
			{/*								type="text"*/}
			{/*								defaultValue={currentUser?.email || ""}*/}
			{/*								onChange={e => updateUserField("email", e.target.value)}*/}
			{/*							/>*/}
			{/*						</div>*/}

			{/*						<div className="col-span-2 lg:col-span-1">*/}
			{/*							<Label>Phone</Label>*/}
			{/*							<Input type="text" defaultValue="+09 363 398 46" />*/}
			{/*						</div>*/}

			{/*						<div className="col-span-2">*/}
			{/*							<Label>Bio</Label>*/}
			{/*							<Input type="text" defaultValue="Team Manager" />*/}
			{/*						</div>*/}
			{/*					</div>*/}
			{/*				</div>*/}
			{/*			</div>*/}
			{/*			<div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">*/}
			{/*				<Button size="sm" variant="outline" onClick={closeModal}>*/}
			{/*					Close*/}
			{/*				</Button>*/}
			{/*				<Button size="sm" onClick={handleSave}>*/}
			{/*					Save Changes*/}
			{/*				</Button>*/}
			{/*			</div>*/}
			{/*		</form>*/}
			{/*	</div>*/}
			{/*</Modal>*/}
		</>
	);
}
