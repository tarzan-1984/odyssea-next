"use client";
import React from "react";
import { useCurrentUser } from "@/stores/userStore";
import IconPdf from "@/components/ui/icons/IconPdf";
import IconTxt from "@/components/ui/icons/IconTxt";
// import users from "@/app-api/users";
// import { UserData } from "@/app-api/api-types";

export default function UserDocumentsCard() {
	// Get user data from Zustand store
	const currentUser = useCurrentUser();

	const documentsFields = [
		{
			label: "Real ID",
			key: "real_id",
			type: "boolean",
			value: currentUser?.organized_data?.documents.real_id,
		},
		{
			label: "Hazmat certificate",
			key: "hazmat_certificate",
			type: "object",
			value: currentUser?.organized_data?.documents.hazmat_certificate.has_certificate,
			file_url: currentUser?.organized_data?.documents.hazmat_certificate.file_url,
		},
		{
			label: "TWIC",
			key: "twic",
			type: "object",
			value: currentUser?.organized_data?.documents.twic.has_certificate,
			file_url: currentUser?.organized_data?.documents.twic.file_url,
		},
		{
			label: "TSA Approved",
			key: "tsa_approved",
			type: "object",
			value: currentUser?.organized_data?.documents.tsa_approved.has_certificate,
			file_url: currentUser?.organized_data?.documents.tsa_approved.file_url,
		},
		{
			label: "Background check",
			key: "background_check",
			type: "object",
			value: currentUser?.organized_data?.documents.background_check.has_certificate,
			file_url: currentUser?.organized_data?.documents.background_check.file_url,
		},
		{
			label: "Change 9 training",
			key: "change_9_training",
			type: "object",
			value: currentUser?.organized_data?.documents.change_9_training.has_certificate,
			file_url: currentUser?.organized_data?.documents.change_9_training.file_url,
		},
	];

	return (
		<>
			<div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
				<div className="flex justify-between flex-wrap gap-6 lg:gap-10">
					<h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
						Documents
					</h4>

					<div className="basis-full">
						<p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
							Driver licence type
						</p>
						<p className="text-sm font-medium text-gray-800 dark:text-white/90">
							{currentUser?.organized_data?.documents?.driver_licence_type
								? currentUser.organized_data.documents.driver_licence_type
								: "-"}
						</p>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-7 2xl:gap-x-32 basis-full">
						{documentsFields.map(field => {
							return (
								<div
									key={field.key}
									className="flex items-center justify-between gap-2"
								>
									<div className="flex items-center gap-2">
										{field.file_url &&
											(() => {
												const ext = field.file_url
													.split(".")
													.pop()
													?.toLowerCase();

												let IconComponent = null;

												if (ext === "pdf") IconComponent = IconPdf;
												else if (ext === "txt") IconComponent = IconTxt;
												else IconComponent = IconPdf;

												return IconComponent ? (
													<a
														href={field.file_url}
														target="_blank"
														rel="noopener noreferrer"
													>
														<IconComponent />
													</a>
												) : null;
											})()}

										<p className="text-xs leading-normal text-gray-500 dark:text-gray-400">
											{field.label}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</>
	);
}
