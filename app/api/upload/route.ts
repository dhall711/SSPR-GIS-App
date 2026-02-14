import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/upload
 *
 * Accepts a multipart form with a "file" field.
 * Uploads the image to Supabase Storage bucket "issue-photos"
 * and returns the public URL.
 *
 * Uses the service role key (server-side only) to bypass RLS on storage.
 */
export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Prefer service role for storage uploads; fall back to anon key
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 400 }
      );
    }

    // Generate a unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const filename = `issues/${timestamp}-${random}.${ext}`;

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("issue-photos")
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      // If bucket doesn't exist, try to create it
      if (
        uploadError.message.includes("not found") ||
        uploadError.message.includes("Bucket")
      ) {
        // Create the bucket (public so photos are viewable)
        const { error: bucketError } = await supabase.storage.createBucket(
          "issue-photos",
          { public: true, fileSizeLimit: 10485760 }
        );

        if (bucketError && !bucketError.message.includes("already exists")) {
          console.error("Bucket creation error:", bucketError);
          return NextResponse.json(
            { error: "Failed to create storage bucket" },
            { status: 500 }
          );
        }

        // Retry upload
        const { error: retryError } = await supabase.storage
          .from("issue-photos")
          .upload(filename, buffer, {
            contentType: file.type,
            upsert: false,
          });

        if (retryError) {
          console.error("Upload retry error:", retryError);
          return NextResponse.json(
            { error: "Failed to upload photo" },
            { status: 500 }
          );
        }
      } else {
        console.error("Upload error:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload photo" },
          { status: 500 }
        );
      }
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("issue-photos").getPublicUrl(filename);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
