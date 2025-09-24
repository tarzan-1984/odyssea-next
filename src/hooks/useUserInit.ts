import { useEffect, useState } from "react";
import { useCurrentUser, useSetCurrentUser } from "@/stores/userStore";
import { clientAuth } from "@/utils/auth";

// Hook to initialize user data from cookies into Zustand store
export const useUserInit = () => {
	const currentUser = useCurrentUser();
	const setCurrentUser = useSetCurrentUser();
	const [isInitializing, setIsInitializing] = useState(!currentUser);

	useEffect(() => {
		// Only initialize if user is not already loaded
		if (!currentUser) {
			const userData = clientAuth.getUserData();
			if (userData) {
				// Convert the user data from cookies to the format expected by the store
				const userDataForStore = {
					id: userData.id,
					role: userData.role,
					status: userData.status,
					organized_data: {
						contact: {
							driver_name: `${userData.firstName} ${userData.lastName}`,
							driver_email: userData.email,
							driver_phone: "",
							date_of_birth: "",
							city: "",
							languages: "",
							team_driver: {
								name: "",
							},
							preferred_distance: "",
							emergency_contact: {
								name: "",
								phone: "",
								relation: "",
							},
							home_location: "",
							city_state_zip: "",
						},
						vehicle: {
							type: {
								label: "",
								value: "",
							},
							make: "",
							model: "",
							year: "",
							payload: "",
							cargo_space_dimensions: "",
							overall_dimensions: "",
							vin: "",
							equipment: {
								side_door: false,
								load_bars: false,
								printer: false,
								sleeper: false,
								ppe: false,
								e_tracks: false,
								pallet_jack: false,
								lift_gate: false,
								dolly: false,
								ramp: false,
							},
						},
						statistics: {
							notifications: {
								all_notifications: [] as [],
								total_count: 0,
							},
							rating: {
								average_rating: 0,
								total_ratings: 0,
								all_ratings: [] as [],
							},
						},
						documents: {
							driver_licence_type: "",
							real_id: false,
							hazmat_certificate: {
								has_certificate: false,
								file_url: "",
							},
							twic: {
								has_certificate: false,
								file_url: "",
							},
							tsa_approved: {
								has_certificate: false,
								file_url: "",
							},
							background_check: {
								has_certificate: false,
								file_url: "",
							},
							change_9_training: {
								has_certificate: false,
								file_url: "",
							},
						},
						current_location: {
							zipcode: "",
							city: "",
							state: "",
							coordinates: {
								lat: "",
								lng: "",
							},
							last_updated: "",
						},
					},
				};

				setCurrentUser(userDataForStore);
				setIsInitializing(false);
				console.log("User initialized from cookies:", userDataForStore);
			} else {
				// No user data found, finish initialization
				setIsInitializing(false);
			}
		} else {
			// User already loaded
			setIsInitializing(false);
		}
	}, [currentUser, setCurrentUser]);

	return { currentUser, isInitializing };
};
