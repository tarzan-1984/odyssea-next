import { string } from "yup";

export interface LoginData {
	email: string;
	password: string;
}

export interface DriverContact {
	driver_name: string;
	driver_email: string;
	driver_phone: string;
	date_of_birth: string;
	city: string;
	languages: string;
	team_driver: {
		enabled: boolean;
		name: string | null;
		phone: string | null;
		email: string | null;
		date_of_birth: string | null;
	};
	preferred_distance: string | null;
	emergency_contact: {
		name: string;
		phone: string;
		relation: string;
	};
	home_location: string;
	city_state_zip: string;
}

export interface DriverVehicle {
	type: {
		label: string;
		value: string;
	};
	make: string;
	model: string;
	year: string;
	payload: string;
	cargo_space_dimensions: string;
	overall_dimensions: string | null;
	vin: string;
	equipment: {
		side_door: boolean;
		load_bars: boolean;
		printer: boolean;
		sleeper: boolean;
		ppe: boolean;
		e_tracks: boolean;
		pallet_jack: boolean;
		lift_gate: boolean;
		dolly: boolean;
		ramp: boolean;
	};
}

export interface DriverDocuments {
	driver_licence_type: string | null;
	real_id: boolean;
	hazmat_certificate: {
		has_certificate: boolean;
		file_url: string | null;
	};
	twic: {
		has_certificate: boolean;
		file_url: string | null;
	};
	tsa_approved: {
		has_certificate: boolean;
		file_url: string | null;
	};
	background_check: {
		has_certificate: boolean;
		file_url: string | null;
	};
	change_9_training: {
		has_certificate: boolean;
		file_url: string | null;
	};
}

export interface DriverStatistics {
	rating: {
		average_rating: number;
		total_ratings: number;
		all_ratings: any[];
	};
	notifications: {
		total_count: number;
		all_notifications: any[];
	};
}

export interface DriverLocation {
	status: string | null;
	available_date: string | null;
	zipcode: string | null;
	city: string | null;
	state: string | null;
	coordinates: {
		lat: string | null;
		lng: string | null;
	};
}

export interface UserOrganizedData {
	current_location: DriverLocation;
	contact: DriverContact;
	vehicle: DriverVehicle;
	documents: DriverDocuments;
	statistics: DriverStatistics;
}

export interface UserData {
	id: string;
	role: string;
	status: string;
	externalId: string;
	avatar?: string;
	email: string;
	firstName: string;
	lastName: string;
	phone: string;
	location: string;
	organized_data?: UserOrganizedData;
}

export interface UserUpdateFormData {
	vehicle: {
		type: {
			label: string;
			value: string;
		};
		make: string;
		model: string;
		year: string;
		payload: string;
		cargo_space_dimensions: string;
		overall_dimensions: string;
		vin: string;
		equipment: {
			side_door: boolean;
			load_bars: boolean;
			printer: boolean;
			sleeper: boolean;
			ppe: boolean;
			e_tracks: boolean;
			pallet_jack: boolean;
			lift_gate: boolean;
			dolly: boolean;
			ramp: boolean;
		}
	},
	current_location: {
		zipcode: string,
		city: string,
		state: string,
		coordinates: {
			lat: string,
			lng: string
		},
		last_updated: string
	},
	contact: {
		driver_name: string;
		driver_phone: string;
		driver_email: string;
		date_of_birth: string;
		city: string;
		languages: string;
		team_driver: {
			name: string;
		};
		preferred_distance: string;
		emergency_contact: {
			name: string;
			phone: string;
			relation: string;
		},
		home_location: string;
		city_state_zip: string;
	},
	documents: {
		driver_licence_type: string,
		real_id: boolean,
		hazmat_certificate: {
			has_certificate: boolean,
			file_url: string
		},
		twic: {
			has_certificate: boolean,
			file_url: string,
		},
		tsa_approved: {
			has_certificate: boolean,
			file_url: string,
		},
		background_check: {
			has_certificate: boolean,
			file_url: string,
		},
		change_9_training: {
			has_certificate: boolean,
			file_url: string,
		}
	},
}

export interface LoginResponse {
	success: boolean;
	message?: string;
	data?: {
		data?: {
			accessToken: string;
			refreshToken: string;
			user: UserData;
			message?: string;
		};
	};
	error?: string;
}

export interface OtpVerificationResponse {
	success: boolean;
	message?: string;
	data?: {
		data?: {
			accessToken: string;
			refreshToken: string;
			user: UserData;
		};
	};
	error?: string;
}

export interface LogoutResponse {
    success: boolean;
    message?: string;
    error?: string;
}

export interface ForgotPasswordResponse {
    success: boolean;
    message?: string;
    error?: string;
}

export interface ResetPasswordResponse {
    success: boolean;
    message?: string;
    error?: string;
}

export interface RefreshTokenResponse {
    success: boolean;
    accessToken?: string;
    error?: string;
}

// Input data interfaces for authentication functions

export interface OtpVerificationData {
    email: string;
    otp: string;
}

export interface LogoutData {
    refreshToken: string;
    accessToken?: string;
}

export interface ForgotPasswordData {
    email: string;
}

export interface ResetPasswordData {
    token: string;
    newPassword: string;
}

export interface RefreshTokenData {
    refreshToken: string;
}

export interface SocialLoginInput {
    provider: 'google' | 'facebook' | 'apple';
    accessToken: string;
}

export interface CreateUserData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    phone?: string;
    profilePhoto?: string;
    language?: string[];
    extension?: string;
    vehicleType?: string;
    vehicleCapacity?: string;
    vehicleDimensions?: string;
    vehicleModel?: string;
    vehicleBrand?: string;
    vehicleYear?: number;
    distanceCoverage?: string;
    hasPalletJack?: boolean;
    hasLiftGate?: boolean;
    hasCDL?: boolean;
    hasTWIC?: boolean;
    hasTSA?: boolean;
    hasHazmatCert?: boolean;
    hasTankerEndorsement?: boolean;
    hasDolly?: boolean;
    hasCanada?: boolean;
    hasMexico?: boolean;
    hasETracks?: boolean;
    hasLoadBars?: boolean;
    hasRamp?: boolean;
    hasDockHigh?: boolean;
    hasPPE?: boolean;
    hasRealID?: boolean;
    hasPrinter?: boolean;
    hasSleeper?: boolean;
}

// New interface for user list items returned from getAllUsers
export interface UserListItem {
    id: string;
	firstName: string;
	lastName: string;
	role: string;
	email: string;
	phone: string;
	location: string;
	type: string;
	vin: string;
	profilePhoto?: string;
	status: string;
	externalId?: string;
}

export interface CreateUserResponse {
    success: boolean;
    data?: UserData;
    error?: string;
}

export interface GetAllUsersParams {
	page?: number;
	limit?: number;
	role?: string;
	status?: string;
	search?: string;
	sort?: { [key: string]: 'asc' | 'desc' };
}

export interface GetAllUsersResponse {
    success: boolean;
    data?: {
        data: {
            users: UserListItem[];
            pagination: {
                current_page: number;
                per_page: number;
                total_count: number;
                total_pages: number;
                has_next_page: boolean;
                has_prev_page: boolean;
            };
            timestamp: string;
            path: string;
        };
        timestamp: string;
        path: string;
    };
    error?: string;
}

export interface GetUserByIdResponse {
    success: boolean;
    data?: {
        data: UserData;
    };
    error?: string;
}

export interface UpdateUserResponse {
    success: boolean;
    data?: UserData;
    error?: string;
}

export interface DeleteUserResponse {
    success: boolean;
    data?: {
        message: string;
    };
    error?: string;
}

export interface ChangeUserStatusResponse {
    success: boolean;
    data?: {
        message: string;
        status: string;
    };
    error?: string;
}

// Input data interfaces for user management functions

export interface CreateUserInput {
    userData: CreateUserData;
    role: string;
}

export interface UpdateUserInput {
    id: string;
    userData: Partial<CreateUserData>;
    role: string;
}

export interface DeleteUserInput {
    id: string;
    role: string;
}

export interface ChangeUserStatusInput {
    id: string;
    status: string;
    role: string;
}

// Chat Room API types
export interface CreateChatRoomData {
    name: string;
    type: "DIRECT" | "GROUP";
    loadId: string;
    participantIds: string[];
}

export interface CreateChatRoomResponse {
    success: boolean;
    data?: {
        id: string;
        name: string;
        type: string;
        loadId: string;
        participants: UserData[];
        createdAt: string;
    };
    error?: string;
}

export interface GetUsersResponse {
    success: boolean;
    data?: {
        users: UserData[];
    };
    error?: string;
}

// TMS Driver API types
export interface TMSDriverResponse {
    success: boolean;
    data?: {
        id: string;
        date_created: string;
        date_updated: string;
        user_id_added: string;
        updated_zipcode: string | null;
        status_post: string;
        organized_data: {
            current_location: {
                status: string | null;
                available_date: string | null;
                zipcode: string | null;
                city: string | null;
                state: string | null;
                coordinates: {
                    lat: number | null;
                    lng: number | null;
                };
            };
            contact: {
                driver_name: string;
                driver_phone: string;
                driver_email: string;
                home_location: string;
                city: string;
                city_state_zip: string;
                date_of_birth: string;
                languages: string;
                team_driver: {
                    enabled: boolean;
                    name: string | null;
                    phone: string | null;
                    email: string | null;
                    date_of_birth: string | null;
                };
                preferred_distance: string | null;
                emergency_contact: {
                    name: string;
                    phone: string;
                    relation: string;
                };
            };
            vehicle: {
                type: {
                    value: string;
                    label: string;
                };
                make: string;
                model: string;
                year: string;
                payload: string;
                cargo_space_dimensions: string;
                overall_dimensions: string;
                vin: string;
                equipment: {
                    side_door: boolean;
                    load_bars: boolean;
                    printer: boolean;
                    sleeper: boolean;
                    ppe: boolean;
                    e_tracks: boolean;
                    pallet_jack: boolean;
                    lift_gate: boolean;
                    dolly: boolean;
                    ramp: boolean;
                };
            };
            documents: {
                driver_licence_type: string | null;
                real_id: boolean;
                hazmat_certificate: {
                    has_certificate: boolean;
                    file_url: string | null;
                };
                twic: {
                    has_certificate: boolean;
                    file_url: string | null;
                };
                tsa_approved: {
                    has_certificate: boolean;
                    file_url: string | null;
                };
                background_check: {
                    has_certificate: boolean;
                    file_url: string | null;
                };
                change_9_training: {
                    has_certificate: boolean;
                    file_url: string | null;
                };
            };
            statistics: {
                rating: {
                    average_rating: number;
                    total_ratings: number;
                    all_ratings: any[];
                };
                notifications: {
                    total_count: number;
                    all_notifications: any[];
                };
            };
        };
        ratings: any[];
        notices: any[];
    };
    error?: string;
}

