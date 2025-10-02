"use client";
import { useState, useEffect } from "react";
import { useCurrentUser } from "@/stores/userStore";
import { useModal } from "@/hooks/useModal";
import { Modal } from "../ui/modal";
import { useForm, Path } from "react-hook-form";
import users from "@/app-api/users";
import { UserData, UserUpdateFormData } from "@/app-api/api-types";
import Label from "../form/Label";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import Button from "../ui/button/Button";


interface IUserVehicleCardProp {
	user: UserData;
}

export default function UserVehicleCard({user}: IUserVehicleCardProp) {
	// Get user data from Zustand store
	const currentUser = useCurrentUser();

	const { isOpen, openModal, closeModal } = useModal();
	const [loading, setLoading] = useState(false);
	const [resultMessage, setResultMessage] = useState<{
		text: string;
		type: "success" | "error";
	} | null>(null);

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		formState: { errors },
	} = useForm<Partial<UserUpdateFormData>>({});

	useEffect(() => {
		if (currentUser) {
			reset({
				vehicle: {
					type: {
						label: currentUser?.organized_data?.vehicle.type.label || "",
						value: currentUser?.organized_data?.vehicle.type.label || "",
					},
					make: currentUser?.organized_data?.vehicle.make || "",
					model: currentUser?.organized_data?.vehicle.model || "",
					year: currentUser?.organized_data?.vehicle.year || "",
					payload: currentUser?.organized_data?.vehicle.payload || "",
					cargo_space_dimensions:
						currentUser?.organized_data?.vehicle.cargo_space_dimensions || "",
					overall_dimensions:
						currentUser?.organized_data?.vehicle.overall_dimensions || "",
					vin: currentUser?.organized_data?.vehicle.vin || "",

					equipment: {
						side_door:
							currentUser?.organized_data?.vehicle?.equipment?.side_door || false,
						load_bars:
							currentUser?.organized_data?.vehicle?.equipment?.load_bars || false,
						printer: currentUser?.organized_data?.vehicle?.equipment?.printer || false,
						sleeper: currentUser?.organized_data?.vehicle?.equipment?.sleeper || false,
						ppe: currentUser?.organized_data?.vehicle?.equipment?.ppe || false,
						e_tracks:
							currentUser?.organized_data?.vehicle?.equipment?.e_tracks || false,
						pallet_jack:
							currentUser?.organized_data?.vehicle?.equipment?.pallet_jack || false,
						lift_gate:
							currentUser?.organized_data?.vehicle?.equipment?.lift_gate || false,
						dolly: currentUser?.organized_data?.vehicle?.equipment?.dolly || false,
						ramp: currentUser?.organized_data?.vehicle?.equipment?.ramp || false,
					},
				},
			});
		}
	}, [currentUser, reset]);

	const onSubmit = async (data: Partial<UserUpdateFormData>) => {
		if (!currentUser?.id) return;

		setLoading(true);
		setResultMessage(null);

		try {
			const result = await users.updateUser(currentUser.id, data);

			if (result.success) {
				setResultMessage({
					text: "Vehicle information updated successfully",
					type: "success",
				});
			} else {
				setResultMessage({ text: "Failed to update vehicle", type: "error" });
			}
		} catch (error) {
			console.error("Network or unexpected error:", error);
			setResultMessage({ text: "Network error. Please try again.", type: "error" });
		} finally {
			setLoading(false);
		}
	};

	const vehicleFields = [
		{ label: "Type", value: user?.organized_data?.vehicle.type.label, key: "type" },
		{ label: "Make", value: user?.organized_data?.vehicle.make, key: "make" },
		{ label: "Model", value: user?.organized_data?.vehicle.model, key: "model" },
		{ label: "Vehicle Year", value: user?.organized_data?.vehicle.year, key: "year" },
		{ label: "Payload", value: user?.organized_data?.vehicle.payload, key: "payload" },
		{
			label: "Cargo space dimensions",
			value: user?.organized_data?.vehicle.cargo_space_dimensions,
			key: "cargo_space_dimensions",
		},
		{
			label: "Overall dimensions",
			value: user?.organized_data?.vehicle.overall_dimensions,
			key: "overall_dimensions",
		},
		{
			label: "Vin",
			value: user?.organized_data?.vehicle?.vin,
			key: "vin",
		},
	];

	const vehicleEquipmentFields = [
		{
			label: "Side door",
			key: "side_door",
			value: user?.organized_data?.vehicle?.equipment?.side_door,
		},
		{
			label: "Load bars",
			key: "load_bars",
			value: user?.organized_data?.vehicle?.equipment?.load_bars,
		},
		{
			label: "Printer",
			key: "printer",
			value: user?.organized_data?.vehicle?.equipment?.printer,
		},
		{
			label: "Sleeper",
			key: "sleeper",
			value: user?.organized_data?.vehicle?.equipment?.sleeper,
		},
		{ label: "PPE", key: "ppe", value: currentUser?.organized_data?.vehicle?.equipment?.ppe },
		{
			label: "E-tracks",
			key: "e_tracks",
			value: user?.organized_data?.vehicle?.equipment?.e_tracks,
		},
		{
			label: "Pallet Jack",
			key: "pallet_jack",
			value: currentUser?.organized_data?.vehicle?.equipment?.pallet_jack,
		},
		{
			label: "Lift Gate",
			key: "lift_gate",
			value: user?.organized_data?.vehicle?.equipment?.lift_gate,
		},
		{
			label: "Dolly",
			key: "dolly",
			value: user?.organized_data?.vehicle?.equipment?.dolly,
		},
		{
			label: "Ramp",
			key: "ramp",
			value: user?.organized_data?.vehicle?.equipment?.ramp,
		},
	];

	return (
		<>
			<div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
				<div className="flex justify-between flex-wrap gap-6 lg:gap-10">
					<h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 order-1">
						Vehicle
					</h4>

					{/*<button
						onClick={openModal}
						className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto order-5 lg:order-2"
					>
						<svg
							className="fill-current"
							width="18"
							height="18"
							viewBox="0 0 18 18"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								fillRule="evenodd"
								clipRule="evenodd"
								d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
								fill=""
							/>
						</svg>
						Edit
					</button>*/}

					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-7 2xl:gap-x-32 basis-full order-2 lg:order-3">
						{vehicleFields.map(field => (
							<div key={field.label}>
								<p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
									{field.label}
								</p>
								<p className="text-sm font-medium text-gray-800 dark:text-white/90">
									{field.value ?? "-"}
								</p>
							</div>
						))}
					</div>

					<p className="text-lg font-semibold text-gray-800 dark:text-white/90 order-3 lg:order-4">
						Equipment
					</p>

					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-7 2xl:gap-x-32 basis-full order-4 lg:order-5">
						{vehicleEquipmentFields.map(field => (
							<div
								key={field.key}
								className="flex items-center justify-between gap-2"
							>
								{field.value && (
									<p className="text-sm font-medium text-gray-800 dark:text-white/90">
										{field.label}
									</p>
								)}
							</div>
						))}
					</div>
				</div>
			</div>

			<Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
				<div className="relative w-full p-4 overflow-y-auto bg-white no-scrollbar rounded-3xl dark:bg-gray-900 lg:p-11 max-h-[90vh]">
					<div className="px-2 pr-14">
						<h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
							Edit Vehicle
						</h4>
						<p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
							Update your details to keep your profile up-to-date.
						</p>
					</div>
					<form className="flex flex-col" onSubmit={handleSubmit(onSubmit)}>
						<div className="px-2 overflow-y-auto custom-scrollbar space-y-5">
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
								<Label className="mb-0">
									<p className="mb-1">Type</p>
									<input
										type="text"
										{...register("vehicle.type.label", {
											onChange: e => {
												setValue("vehicle.type.value", e.target.value);
											},
										})}
										className="input-style"
									/>
									<input type="hidden" {...register("vehicle.type.value")} />
									{errors.vehicle?.type?.label && (
										<p className="text-error-500 text-sm mt-1">
											{errors.vehicle.type.label.message}
										</p>
									)}
								</Label>

								<Label className="mb-0">
									<p className="mb-1">Make</p>
									<input
										type="text"
										{...register("vehicle.make")}
										className="input-style"
									/>
									{errors.vehicle?.make && (
										<p className="text-error-500 text-sm mt-1">
											{errors.vehicle.make.message}
										</p>
									)}
								</Label>

								<Label className="mb-0">
									<p className="mb-1">Model</p>
									<input
										type="text"
										{...register("vehicle.model")}
										className="input-style"
									/>
									{errors.vehicle?.model && (
										<p className="text-error-500 text-sm mt-1">
											{errors.vehicle.model.message}
										</p>
									)}
								</Label>

								<Label className="mb-0">
									<p className="mb-1">Vehicle Year</p>
									<input
										type="text"
										{...register("vehicle.year")}
										className="input-style"
									/>
									{errors.vehicle?.year && (
										<p className="text-error-500 text-sm mt-1">
											{errors.vehicle.year.message}
										</p>
									)}
								</Label>

								<Label className="mb-0">
									<p className="mb-1">Payload</p>
									<input
										type="text"
										{...register("vehicle.payload")}
										className="input-style"
									/>
									{errors.vehicle?.payload && (
										<p className="text-error-500 text-sm mt-1">
											{errors.vehicle.payload.message}
										</p>
									)}
								</Label>

								<Label className="mb-0">
									<p className="mb-1">Cargo space dimensions</p>
									<input
										type="text"
										{...register("vehicle.cargo_space_dimensions")}
										className="input-style"
									/>
									{errors.vehicle?.cargo_space_dimensions && (
										<p className="text-error-500 text-sm mt-1">
											{errors.vehicle.cargo_space_dimensions.message}
										</p>
									)}
								</Label>

								<Label className="mb-0">
									<p className="mb-1">Overall dimensions</p>
									<input
										type="text"
										{...register("vehicle.overall_dimensions")}
										className="input-style"
									/>
									{errors.vehicle?.overall_dimensions && (
										<p className="text-error-500 text-sm mt-1">
											{errors.vehicle.overall_dimensions.message}
										</p>
									)}
								</Label>

								<Label className="mb-0">
									<p className="mb-1">Vin</p>
									<input
										type="number"
										{...register("vehicle.vin")}
										className="input-style"
									/>
									{errors.vehicle?.vin && (
										<p className="text-error-500 text-sm mt-1">
											{errors.vehicle.vin.message}
										</p>
									)}
								</Label>
							</div>

							<div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
								{vehicleEquipmentFields.map(field => (
									<label
										className="inline-flex items-center gap-2 cursor-pointer relative"
										key={field.key}
									>
										<div className="relative">
											<input
												type="checkbox"
												className="sr-only peer"
												{...register(
													`vehicle.equipment.${field.key}` as Path<UserUpdateFormData>
												)}
											/>
											<div className="w-9 h-5 flex items-center rounded-full transition-colors duration-300 bg-gray-200 peer-checked:bg-brand-600"></div>
											<div className="bg-white w-4 h-4 absolute top-0.5 left-0.5 rounded-full shadow-sm transform transition duration-300 peer-checked:translate-x-4"></div>
										</div>
										<p className="text-sm text-gray-700 dark:text-gray-400">
											{field.label}
										</p>
									</label>
								))}
							</div>
						</div>
						<div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
							<Button size="sm" variant="outline" onClick={closeModal}>
								Close
							</Button>
							<Button type="submit" size="sm" disabled={loading}>
								Save Changes
							</Button>
						</div>

						{resultMessage && (
							<div
								className={`fixed top-5 right-5 px-4 py-2 rounded-lg shadow-lg animate-fadeOut
									${resultMessage.type === "success" ? "bg-success-500" : "bg-error-500"}
								`}
							>
								<p className="text-white">{resultMessage.text}</p>
							</div>
						)}
					</form>

					{loading && (
						<div className="absolute w-full h-full bg-white top-0 left-0 z-1 flex justify-center items-center">
							<SpinnerOne />
						</div>
					)}
				</div>
			</Modal>
		</>
	);
}
