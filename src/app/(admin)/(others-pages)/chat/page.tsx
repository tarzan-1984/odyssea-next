import ChatContainer from "@/components/chats/ChatContainer";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { ChatModalProvider } from "@/context/ChatModalContext";
import ChatPageClient from "./ChatPageClient";
import { Metadata } from "next";
import React, { Suspense } from "react";

export const metadata: Metadata = {
	title: "Odysseia Web",
	description: "Odysseia Web Application - Chat",
};

function ChatFallback() {
	return (
		<div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
			<p className="text-sm text-gray-500 dark:text-gray-400">Loading chat...</p>
		</div>
	);
}

export default function Chat() {
	return (
		<ChatModalProvider>
			<div>
				<PageBreadcrumb pageTitle="Chats" />
				<div className="h-[calc(100vh-150px)] overflow-hidden sm:h-[calc(100vh-174px)]">
					<Suspense fallback={<ChatFallback />}>
						<ChatContainer />
					</Suspense>
				</div>
			</div>
			<ChatPageClient />
		</ChatModalProvider>
	);
}
