"use client";

import React, {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import type { Message } from "@/app-api/chatApi";
import ChatImageLightbox from "@/components/chats/ChatImageLightbox";
import {
	collectChatGalleryImages,
	mergeGalleryWithClickedImage,
	type ChatGalleryImage,
	type OpenImageInput,
} from "@/utils/chatGalleryImages";

type ChatImageGalleryContextValue = {
	openImage: (image: OpenImageInput) => void;
};

const ChatImageGalleryContext = createContext<ChatImageGalleryContextValue | null>(
	null
);

export function useChatImageGalleryOptional(): ChatImageGalleryContextValue | null {
	return useContext(ChatImageGalleryContext);
}

export function ChatImageGalleryProvider({
	messages,
	children,
}: {
	messages: Message[];
	children: React.ReactNode;
}) {
	const galleryImages = useMemo(
		() => collectChatGalleryImages(messages),
		[messages]
	);
	const [isOpen, setIsOpen] = useState(false);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [activeImages, setActiveImages] = useState<ChatGalleryImage[]>([]);

	const openImage = useCallback(
		(image: OpenImageInput) => {
			const { images, index } = mergeGalleryWithClickedImage(galleryImages, image);
			setActiveImages(images);
			setCurrentIndex(index);
			setIsOpen(true);
		},
		[galleryImages]
	);

	const close = useCallback(() => {
		setIsOpen(false);
		setActiveImages([]);
	}, []);

	const goPrev = useCallback(() => {
		setCurrentIndex(i => Math.max(0, i - 1));
	}, []);

	const goNext = useCallback(() => {
		setCurrentIndex(i => Math.min(activeImages.length - 1, i + 1));
	}, [activeImages.length]);

	const value = useMemo(() => ({ openImage }), [openImage]);

	return (
		<ChatImageGalleryContext.Provider value={value}>
			{children}
			<ChatImageLightbox
				isOpen={isOpen && activeImages.length > 0}
				images={activeImages}
				currentIndex={currentIndex}
				onClose={close}
				onPrev={goPrev}
				onNext={goNext}
			/>
		</ChatImageGalleryContext.Provider>
	);
}
