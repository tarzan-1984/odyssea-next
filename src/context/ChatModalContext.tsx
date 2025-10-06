"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";

interface ChatModalContextType {
	isAddRoomModalOpen: boolean;
	openAddRoomModal: () => void;
	closeAddRoomModal: () => void;
	isContactsModalOpen: boolean;
	openContactsModal: () => void;
	closeContactsModal: () => void;
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
	const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);

	const openAddRoomModal = () => {
		setIsAddRoomModalOpen(true);
	};
	const closeAddRoomModal = () => {
		setIsAddRoomModalOpen(false);
	};

	const openContactsModal = () => {
		setIsContactsModalOpen(true);
	};
	const closeContactsModal = () => {
		setIsContactsModalOpen(false);
	};

	return (
		<ChatModalContext.Provider
			value={{
				isAddRoomModalOpen,
				openAddRoomModal,
				closeAddRoomModal,
				isContactsModalOpen,
				openContactsModal,
				closeContactsModal,
			}}
		>
			{children}
		</ChatModalContext.Provider>
	);
};
