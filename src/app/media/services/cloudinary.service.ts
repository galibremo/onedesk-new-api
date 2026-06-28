import axios from 'axios';
import { v2 as cloudinary, type UploadApiErrorResponse, type UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

// Configuration interface
interface CloudinaryConfig {
	cloudName: string;
	apiKey: string;
	apiSecret: string;
	folder?: string;
}

// Upload options interface
interface UploadOptions {
	folder?: string;
	publicId?: string;
	transformation?: {
		quality?: string | number;
		format?: string;
		width?: number;
		height?: number;
		crop?: string;
	};
	tags?: string[];
	context?: Record<string, string>;
	overwrite?: boolean;
	invalidate?: boolean;
}

// Upload result interface
export interface UploadResult {
	success: boolean;
	data?: UploadApiResponse;
	error?: string;
}

// Image details result interface
export interface ImageDetailsResult {
	success: boolean;
	data?: Record<string, unknown>;
	error?: string;
}

export class CloudinaryImageService {
	private config: CloudinaryConfig;

	constructor(config: CloudinaryConfig) {
		this.config = config;
		this.initializeCloudinary();
	}

	/**
	 * Initialize Cloudinary configuration
	 */
	private initializeCloudinary(): void {
		cloudinary.config({
			cloud_name: this.config.cloudName,
			api_key: this.config.apiKey,
			api_secret: this.config.apiSecret,
			secure: true,
		});
	}

	/**
	 * Upload image from Google profile URL
	 * @param googleImageUrl - URL of the Google profile image
	 * @param options - Upload options
	 * @returns Upload result
	 */
	async uploadFromGoogleUrl(
		googleImageUrl: string,
		options?: UploadOptions,
	): Promise<UploadResult> {
		try {
			// Fetch the image from Google URL
			const response = await axios.get(googleImageUrl, {
				responseType: 'arraybuffer',
				timeout: 10000,
			});

			const buffer = Buffer.from(response.data as ArrayBuffer);

			// Upload to Cloudinary
			return await this.uploadFromBuffer(buffer, options);
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to upload from Google URL',
			};
		}
	}

	/**
	 * Upload image from buffer
	 * @param buffer - Image buffer
	 * @param options - Upload options
	 * @returns Upload result
	 */
	async uploadFromBuffer(buffer: Buffer, options?: UploadOptions): Promise<UploadResult> {
		return new Promise(resolve => {
			const uploadStream = cloudinary.uploader.upload_stream(
				this.buildUploadOptions(options),
				(error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
					if (error || !result) {
						resolve({
							success: false,
							error: error?.message || 'Upload failed',
						});
					} else {
						resolve({
							success: true,
							data: result,
						});
					}
				},
			);

			const readable = Readable.from(buffer);
			readable.pipe(uploadStream);
		});
	}

	/**
	 * Upload image from base64 string
	 * @param base64String - Base64 encoded image
	 * @param options - Upload options
	 * @returns Upload result
	 */
	async uploadFromBase64(base64String: string, options?: UploadOptions): Promise<UploadResult> {
		try {
			const result = await cloudinary.uploader.upload(
				base64String,
				this.buildUploadOptions(options),
			);

			return {
				success: true,
				data: result,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Upload failed',
			};
		}
	}

	/**
	 * Upload image from local file path
	 * @param filePath - Path to the local file
	 * @param options - Upload options
	 * @returns Upload result
	 */
	async uploadFromFilePath(filePath: string, options?: UploadOptions): Promise<UploadResult> {
		try {
			const result = await cloudinary.uploader.upload(filePath, this.buildUploadOptions(options));

			return {
				success: true,
				data: result,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Upload failed',
			};
		}
	}

	/**
	 * Upload image with face detection
	 * @param source - Buffer or URL of the image
	 * @param options - Upload options with face detection settings
	 * @returns Upload result with face detection data
	 */
	async uploadWithFaceDetection(
		source: Buffer | string,
		options?: UploadOptions & {
			cropToFace?: boolean;
			gravity?: 'face' | 'faces' | 'face:center' | 'face:auto';
			zoom?: number;
			size?: number;
		},
	): Promise<UploadResult> {
		try {
			const uploadOptions: Record<string, unknown> = {
				...this.buildUploadOptions(options),
				faces: true, // Return face coordinates
			};

			// Set 1:1 aspect ratio (square) with face detection
			const size = options?.size || 500; // Default 500x500
			uploadOptions.width = size;
			uploadOptions.height = size;
			uploadOptions.crop = 'fill';
			uploadOptions.gravity = options?.gravity || 'face';
			uploadOptions.aspect_ratio = '1:1';

			// If crop to face is enabled, add zoom
			if (options?.cropToFace && options.zoom) {
				uploadOptions.zoom = options.zoom;
			}

			let result: UploadApiResponse;

			// Handle buffer or URL
			if (Buffer.isBuffer(source)) {
				result = await new Promise((resolve, reject) => {
					const uploadStream = cloudinary.uploader.upload_stream(
						uploadOptions,
						(
							error: UploadApiErrorResponse | undefined,
							uploadResult: UploadApiResponse | undefined,
						) => {
							if (error || !uploadResult) {
								reject(new Error(error?.message || 'Upload failed'));
							} else {
								resolve(uploadResult);
							}
						},
					);

					const readable = Readable.from(source);
					readable.pipe(uploadStream);
				});
			} else {
				result = await cloudinary.uploader.upload(source, uploadOptions);
			}

			return {
				success: true,
				data: result,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Face detection upload failed',
			};
		}
	}

	/**
	 * Build upload options with WebP conversion and quality optimization
	 * @param options - User provided options
	 * @returns Cloudinary upload options
	 */
	private buildUploadOptions(options?: UploadOptions): Record<string, unknown> {
		const defaultOptions: Record<string, unknown> = {
			folder: options?.folder || this.config.folder || 'uploads',
			resource_type: 'image' as const,
			format: 'webp', // Convert to WebP
			quality: 'auto:good', // Automatic quality with good balance
			fetch_format: 'auto',
			flags: 'lossy', // Enable lossy compression for better size reduction
			overwrite: options?.overwrite ?? false,
			invalidate: options?.invalidate ?? false,
			unique_filename: true,
			use_filename: true,
		};

		if (options?.publicId) {
			defaultOptions['public_id'] = options.publicId;
		}

		if (options?.tags && options.tags.length > 0) {
			defaultOptions['tags'] = options.tags;
		}

		if (options?.context) {
			defaultOptions['context'] = options.context;
		}

		// Apply custom transformations if provided
		if (options?.transformation) {
			const { quality, format, width, height, crop } = options.transformation;

			if (quality !== undefined) defaultOptions['quality'] = String(quality);
			if (format) defaultOptions['format'] = format;
			if (width) defaultOptions['width'] = width;
			if (height) defaultOptions['height'] = height;
			if (crop) defaultOptions['crop'] = crop;
		}

		return defaultOptions;
	}

	/**
	 * Delete image from Cloudinary
	 * @param publicId - Public ID of the image to delete
	 * @returns Deletion result
	 */
	async deleteMedia(publicId: string): Promise<{ success: boolean; error?: string }> {
		try {
			await cloudinary.uploader.destroy(publicId);
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Deletion failed',
			};
		}
	}

	/**
	 * Get optimized image URL with transformations
	 * @param publicId - Public ID of the image
	 * @param transformations - Additional transformations
	 * @returns Optimized URL
	 */
	getOptimizedUrl(
		publicId: string,
		transformations?: {
			width?: number;
			height?: number;
			quality?: string | number;
			crop?: string;
			format?: string;
		},
	): string {
		return cloudinary.url(publicId, {
			fetch_format: 'auto',
			quality: transformations?.quality || 'auto',
			width: transformations?.width,
			height: transformations?.height,
			crop: transformations?.crop || 'limit',
			format: transformations?.format || 'webp',
			secure: true,
		});
	}

	/**
	 * Get image details from Cloudinary
	 * @param publicId - Public ID of the image
	 * @returns Image resource details
	 */
	async getImageDetails(publicId: string): Promise<ImageDetailsResult> {
		try {
			const result = (await cloudinary.api.resource(publicId)) as Record<string, unknown>;
			return { success: true, data: result };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch image details',
			};
		}
	}
}
