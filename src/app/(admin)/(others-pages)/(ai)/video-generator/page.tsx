import AiLayout from "@/components/ai/AiLayout";
import AiPageBreadcrumb from "@/components/ai/AiPageBreadcrumb";
import VideoGeneratorContent from "@/components/ai/VideoGeneratorContent";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "Odysseia Web",
	description:
		"This is Next.js AI Video Generator page for TailAdmin - Next.js Tailwind CSS Admin Dashboard Template",
};

export default function page() {
	return (
		<div>
			<AiPageBreadcrumb pageTitle="Video Generator" />
			<AiLayout>
				<VideoGeneratorContent />
			</AiLayout>
		</div>
	);
}
