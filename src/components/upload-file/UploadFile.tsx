import React, { useRef, useState } from "react";

interface IUploadFile {
	value?: File | null;
	onChange: (file: File | null) => void;
	children?: React.ReactNode;
	className?: string;
	allowedTypes?: string[];
}

const UploadFile: React.FC<IUploadFile> = ({ onChange, children, className, allowedTypes }) => {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(false);

		const file = e.dataTransfer.files?.[0] || null;

		if (file && allowedTypes?.includes(file.type)) {
			onChange(file);
			setError(null);
		} else {
			setError(`Only files of types ${allowedTypes?.join(", ")} are allowed`);
		}
	};

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = () => {
		setIsDragging(false);
	};

	const handleClick = () => {
		inputRef.current?.click();
	};

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				onChange={e => {
					const file = e.target.files?.[0] || null;
					if (file && allowedTypes?.includes(file.type)) {
						onChange(file);
						setError(null);
					} else {
						setError(`Only files of types ${allowedTypes?.join(", ")} are allowed`);
					}
				}}
				className="sr-only"
			/>

			<div
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onClick={handleClick}
				className={`cursor-pointer transition-ease-in-out ${isDragging ? "bg-primary-25" : ""} ${className ?? ""}`}
			>
				{children}
			</div>
			{error && <div className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</div>}
		</>
	);
};

export default UploadFile;
