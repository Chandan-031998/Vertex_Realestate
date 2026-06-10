import { z } from "zod";

export const createPropertySchema = z.object({
  body: z.object({
    title: z.string().min(2),
    type: z.enum(["Residential", "Commercial", "Plot", "Villa", "Apartment"]),
    status: z.string().optional(),
    description: z.string().optional(),

    city: z.string().optional(),
    area: z.string().optional(),
    pincode: z.string().optional(),
    landmark: z.string().optional(),
    map_link: z.string().optional(),

    base_price: z.number().or(z.string()).optional(),
    negotiable: z.boolean().or(z.number()).optional(),
    taxes: z.number().or(z.string()).optional(),
    brokerage: z.number().or(z.string()).optional(),
    maintenance_fee: z.number().or(z.string()).optional(),
    stamp_duty_estimate: z.number().or(z.string()).optional(),

    video_link: z.string().url().optional().or(z.literal("")),

    is_published: z.boolean().or(z.number()).optional(),
    is_featured: z.boolean().or(z.number()).optional(),
    seo_title: z.string().optional(),
    seo_description: z.string().optional(),
    seo_keywords: z.string().optional(),

    amenity_ids: z.array(z.number()).optional(),
  })
});

export const updatePropertySchema = createPropertySchema;
