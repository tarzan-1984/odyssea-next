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
	findChatGalleryImageIndex,
	mergeGalleryWithClickedImage,
	type ChatGalleryImage,
	type OpenImageInput,
} from "@/utils/chatGalleryImages";

export type OpenImageOptions = {
	viewOnly?: boolean;
	/** When set, use this list instead of images from chat messages */
	images?: OpenImageInput[];
};

type ChatImageGalleryContextValue = {
	openImage: (image: OpenImageInput, options?: OpenImageOptions) => void;
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
	const [viewOnly, setViewOnly] = useState(false);

	const openImage = useCallback(
		(image: OpenImageInput, options?: OpenImageOptions) => {
			let images: ChatGalleryImage[];
			let index: number;

			if (options?.images?.length) {
				images = options.images.map(img => ({
					fileUrl: img.fileUrl,
					fileName: img.fileName,
					fileSize: img.fileSize,
					messageId: "",
				}));
				index = findChatGalleryImageIndex(images, image);
				if (index < 0) index = 0;
			} else {
				const merged = mergeGalleryWithClickedImage(galleryImages, image);
				images = merged.images;
				index = merged.index;
			}

			setViewOnly(options?.viewOnly ?? false);
			setActiveImages(images);
			setCurrentIndex(index);
			setIsOpen(true);
		},
		[galleryImages]
	);

	const close = useCallback(() => {
		setIsOpen(false);
		setActiveImages([]);
		setViewOnly(false);
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
				viewOnly={viewOnly}
				onClose={close}
				onPrev={goPrev}
				onNext={goNext}
			/>
		</ChatImageGalleryContext.Provider>
	);
}
