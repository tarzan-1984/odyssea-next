import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OtpForm from "../OtpForm";

// Mock the authentication module
jest.mock("@/app-api/authentication", () => ({
	verifyOTP: jest.fn(),
}));

// Mock the auth utility
jest.mock("@/utils/auth", () => ({
	clientAuth: {
		setAccessToken: jest.fn(),
		setRefreshToken: jest.fn(),
		setUserData: jest.fn(),
		removeLoginSuccess: jest.fn(),
	},
}));

// Mock Next.js router
jest.mock("next/navigation", () => ({
	useRouter: () => ({
		push: jest.fn(),
		replace: jest.fn(),
	}),
}));

import authentication from "@/app-api/authentication";
import { clientAuth } from "@/utils/auth";

describe("OtpForm", () => {
	const mockVerifyOTP = authentication.verifyOTP;
	const mockSetAccessToken = clientAuth.setAccessToken;
	const mockSetRefreshToken = clientAuth.setRefreshToken;
	const mockSetUserData = clientAuth.setUserData;
	const mockRemoveLoginSuccess = clientAuth.removeLoginSuccess;

	beforeEach(() => {
		jest.clearAllMocks();
		mockVerifyOTP.mockResolvedValue({
			success: true,
			data: {
				data: {
					accessToken: "test-access-token",
					refreshToken: "test-refresh-token",
					user: {
						id: "123",
						email: "test@example.com",
						firstName: "John",
						lastName: "Doe",
						role: "user",
						status: "active",
						avatar: "avatar.jpg",
					},
				},
			},
		});
	});

	it("renders the OTP verification form correctly", () => {
		render(<OtpForm />);

		// Check if form elements are rendered
		expect(screen.getByText("Two-Step Verification")).toBeInTheDocument();
		expect(screen.getByText(/we've sent a verification code to/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/otp code/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /verify otp/i })).toBeInTheDocument();
		expect(screen.getByText(/didn't receive the code/i)).toBeInTheDocument();
		expect(screen.getByText(/resend/i)).toBeInTheDocument();
	});

	it("allows user to input OTP code", async () => {
		const user = userEvent.setup();
		render(<OtpForm />);

		const otpInput = screen.getByLabelText(/otp code/i);

		// Type OTP code
		await user.type(otpInput, "123456");

		// Check if value is set
		expect(otpInput).toHaveValue("123456");
	});

	it("shows validation error for empty OTP", async () => {
		const user = userEvent.setup();
		render(<OtpForm />);

		const verifyButton = screen.getByRole("button", { name: /verify otp/i });

		// Click verify button without entering OTP
		await user.click(verifyButton);

		// Should show validation error
		await waitFor(() => {
			expect(screen.getByText("OTP code is required")).toBeInTheDocument();
		});
	});

	it("shows validation error for short OTP", async () => {
		const user = userEvent.setup();
		render(<OtpForm />);

		const otpInput = screen.getByLabelText(/otp code/i);
		const verifyButton = screen.getByRole("button", { name: /verify otp/i });

		// Enter short OTP
		await user.type(otpInput, "123");

		// Click verify button
		await user.click(verifyButton);

		// Should show validation error
		await waitFor(() => {
			expect(screen.getByText("OTP code must be 6 characters")).toBeInTheDocument();
		});
	});

	it("verifies OTP successfully and sets tokens", async () => {
		const user = userEvent.setup();
		render(<OtpForm />);

		const otpInput = screen.getByLabelText(/otp code/i);
		const verifyButton = screen.getByRole("button", { name: /verify otp/i });

		// Enter valid OTP
		await user.type(otpInput, "123456");

		// Click verify button
		await user.click(verifyButton);

		// Should call verifyOTP API
		await waitFor(() => {
			expect(mockVerifyOTP).toHaveBeenCalledWith({
				email: "test@example.com",
				otp: "123456",
			});
		});

		// Should set tokens and user data
		expect(mockSetAccessToken).toHaveBeenCalledWith("test-access-token");
		expect(mockSetRefreshToken).toHaveBeenCalledWith("test-refresh-token");
		expect(mockSetUserData).toHaveBeenCalledWith({
			id: "123",
			email: "test@example.com",
			firstName: "John",
			lastName: "Doe",
			role: "user",
			status: "active",
			avatar: "avatar.jpg",
		});

		// Should remove login success cookie
		expect(mockRemoveLoginSuccess).toHaveBeenCalled();
	});

	it("handles OTP verification failure", async () => {
		mockVerifyOTP.mockResolvedValue({
			success: false,
			error: "Invalid OTP code",
		});

		const user = userEvent.setup();
		render(<OtpForm />);

		const otpInput = screen.getByLabelText(/otp code/i);
		const verifyButton = screen.getByRole("button", { name: /verify otp/i });

		// Enter OTP
		await user.type(otpInput, "123456");

		// Click verify button
		await user.click(verifyButton);

		// Should show error message
		await waitFor(() => {
			expect(screen.getByText("Invalid OTP code")).toBeInTheDocument();
		});
	});

	it("handles network errors gracefully", async () => {
		mockVerifyOTP.mockRejectedValue(new Error("Network error"));

		const user = userEvent.setup();
		render(<OtpForm />);

		const otpInput = screen.getByLabelText(/otp code/i);
		const verifyButton = screen.getByRole("button", { name: /verify otp/i });

		// Enter OTP
		await user.type(otpInput, "123456");

		// Click verify button
		await user.click(verifyButton);

		// Should show network error message
		await waitFor(() => {
			expect(screen.getByText("Network error occurred")).toBeInTheDocument();
		});
	});

	it("shows loading state during verification", async () => {
		// Mock a delayed response
		mockVerifyOTP.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

		const user = userEvent.setup();
		render(<OtpForm />);

		const otpInput = screen.getByLabelText(/otp code/i);
		const verifyButton = screen.getByRole("button", { name: /verify otp/i });

		// Enter OTP
		await user.type(otpInput, "123456");

		// Click verify button
		await user.click(verifyButton);

		// Button should show loading state
		expect(verifyButton).toBeDisabled();
		expect(screen.getByText("Verifying...")).toBeInTheDocument();
	});

	it("clears error messages when form is resubmitted", async () => {
		// First, submit with invalid OTP to show error
		mockVerifyOTP.mockResolvedValueOnce({
			success: false,
			error: "Invalid OTP code",
		});

		const user = userEvent.setup();
		render(<OtpForm />);

		const otpInput = screen.getByLabelText(/otp code/i);
		const verifyButton = screen.getByRole("button", { name: /verify otp/i });

		// Enter OTP
		await user.type(otpInput, "123456");

		// Click verify button
		await user.click(verifyButton);

		// Should show error message
		await waitFor(() => {
			expect(screen.getByText("Invalid OTP code")).toBeInTheDocument();
		});

		// Now mock success response
		mockVerifyOTP.mockResolvedValueOnce({
			success: true,
			data: {
				data: {
					accessToken: "test-access-token",
					refreshToken: "test-refresh-token",
					user: {
						id: "123",
						email: "test@example.com",
						firstName: "John",
						lastName: "Doe",
						role: "user",
						status: "active",
						avatar: "avatar.jpg",
					},
				},
			},
		});

		// Submit again
		await user.click(verifyButton);

		// Error should be cleared
		await waitFor(() => {
			expect(screen.queryByText("Invalid OTP code")).not.toBeInTheDocument();
		});
	});

	it("shows resend code functionality", () => {
		render(<OtpForm />);

		const resendText = screen.getByText(/didn't receive the code/i);
		const resendLink = screen.getByText(/resend/i);

		expect(resendText).toBeInTheDocument();
		expect(resendLink).toBeInTheDocument();
		expect(resendLink.tagName).toBe("A");
	});

	it("displays email from login success cookie", () => {
		// Mock the getLoginSuccess function to return an email
		const mockGetLoginSuccess = clientAuth.getLoginSuccess;
		mockGetLoginSuccess.mockReturnValue("test@example.com");

		render(<OtpForm />);

		expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
	});
});
