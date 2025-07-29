'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Cross2Icon } from '@radix-ui/react-icons';
import { CloudUpload } from 'lucide-react';
import Image from 'next/image';
import Button from './button';

interface FileWithPreview extends File {
  preview: string;
}

export default function AvatarUploader({
  handleChange,
  handleDelete,
  initialAvatar,
}: {
  handleChange: (file: FileWithPreview) => void;
  handleDelete: () => void;
  initialAvatar?: string;
}) {
  const [file, setFile] = useState<FileWithPreview | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const newFile = Object.assign(acceptedFiles[0], {
          preview: URL.createObjectURL(acceptedFiles[0]),
        });
        setFile(newFile);
        handleChange(newFile);
      }
    },
    [handleChange],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        'image/jpeg': [],
        'image/png': [],
      },
      maxFiles: 1,
    });
  const removeFile = () => {
    if (
      window.confirm('Are you sure you want to remove this profile picture?')
    ) {
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      setFile(null);
      handleDelete();
    }
  };

  return (
    <div className="max-w-md">
      {file || initialAvatar ? (
        <div
          className="flex flex-col gap-4 text-center"
          role="group"
          aria-label="Selected profile picture preview"
        >
          <div
            {...getRootProps()}
            className="group relative flex h-36 w-36 cursor-pointer select-none flex-col items-center justify-center gap-2 rounded-full p-4 transition-all duration-150 ease-in-out"
          >
            <input
              {...getInputProps()}
              aria-label="Choose profile picture file"
            />
            <Image
              src={file?.preview || initialAvatar || ''}
              alt="Profile picture preview"
              fill
              style={{ objectFit: 'cover' }}
              className="rounded-full"
              sizes="100%"
            />
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-all duration-150 group-hover:bg-black/60">
              <CloudUpload
                className="text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                width={24}
                height={24}
                aria-hidden="true"
              />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button
              handleClick={removeFile}
              className="transition-effect flex items-center gap-1 text-sm text-error hover:opacity-90"
              variant="unstyled"
              aria-label="Remove selected profile picture"
            >
              <Cross2Icon width={16} height={16} aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`flex h-36 w-36 cursor-pointer select-none flex-col items-center justify-center gap-2 rounded-full border-2 p-4 transition-all duration-150 ease-in-out ${
            isDragReject
              ? 'bg-error/10 border-error'
              : isDragActive
                ? 'border-stroke-weak bg-fill-hover'
                : 'border-stroke-weak bg-fill hover:bg-fill-hover'
          }`}
          role="button"
          aria-label="Upload profile picture"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.currentTarget.click();
            }
          }}
        >
          <input
            {...getInputProps()}
            aria-label="Choose profile picture file"
          />
          <CloudUpload width={24} height={24} aria-hidden="true" />
          <p className="text-sm">
            {isDragReject
              ? 'Unsupported file type'
              : isDragActive
                ? 'Drop image here'
                : 'Upload image'}
          </p>
        </div>
      )}
    </div>
  );
}
