import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(2, "Name must be at least 2 characters"),
  lastName: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const ProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.number().int().positive("Price must be positive"),
  oldPrice: z
    .number()
    .int()
    .positive("Old price must be positive")
    .optional()
    .nullable(),
  discountPercentage: z.number().int().min(0).max(100).optional().nullable(),
  label: z.string().optional().nullable(),
  categoryId: z.string().uuid("Invalid category ID"),
  imageUrls: z.array(z.string().url()).min(1, "At least one image is required"),
  stock: z.number().int().min(0, "Stock cannot be negative"),
});

export const CategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export const CheckoutSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid("Invalid product ID"),
      quantity: z.number().int().positive("Quantity must be positive"),
    })
  ),
  email: z.string().email("Invalid email address"),
});

export const OrderStatusSchema = z.object({
  deliveryStatus: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
});
