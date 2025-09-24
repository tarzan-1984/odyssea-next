"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";

interface ChatModalContextType {
	isAddRoomModalOpen: boolean;
	openAddRoomModal: () => void;
	closeAddRoomModal: () => void;
}

const ChatModalContext = createContext<ChatModalContextType | undefined>(undefined);

export const useChatModal = () => {
	const context = useContext(ChatModalContext);
	if (!context) {
		throw new Error("useChatModal must be used within a ChatModalProvider");
	}
	return context;
};

interface ChatModalProviderProps {
	children: ReactNode;
}

export const ChatModalProvider: React.FC<ChatModalProviderProps> = ({ children }) => {
	const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);

	const openAddRoomModal = () => {
		setIsAddRoomModalOpen(true);
	};
	const closeAddRoomModal = () => {
		setIsAddRoomModalOpen(false);
	};

	return (
		<ChatModalContext.Provider
			value={{
				isAddRoomModalOpen,
				openAddRoomModal,
				closeAddRoomModal,
			}}
		>
			{children}
		</ChatModalContext.Provider>
	);
};
