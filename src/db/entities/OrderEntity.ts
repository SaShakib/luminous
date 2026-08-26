import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn
} from "typeorm";
import { OrderItemEntity } from "./OrderItemEntity";
import { UserEntity } from "./UserEntity";

@Entity({ name: "orders" })
@Check("chk_orders_amount_cents", "amount_cents >= 0")
@Check("chk_orders_subtotal_amount_cents", "subtotal_amount_cents >= 0")
@Check("chk_orders_discount_amount_cents", "discount_amount_cents >= 0")
@Check("chk_orders_tax_amount_cents", "tax_amount_cents >= 0")
@Check("chk_orders_shipping_amount_cents", "shipping_amount_cents >= 0")
@Check("chk_orders_total_amount_cents", "total_amount_cents >= 0")
@Check("chk_orders_order_status", "order_status IN ('pending', 'confirmed', 'cancelled', 'refunded', 'fulfilled')")
@Check("chk_orders_payment_status", "payment_status IN ('unpaid', 'authorized', 'paid', 'failed', 'refunded')")
@Check(
  "chk_orders_fulfillment_status",
  "fulfillment_status IN ('not_started', 'processing', 'shipped', 'delivered', 'cancelled')"
)
export class OrderEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => UserEntity, (user) => user.orders, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserEntity;

  @Column({ name: "order_number", type: "text", unique: true })
  orderNumber!: string;

  @Column({ name: "product_sku", type: "text" })
  productSku!: string;

  @Column({ name: "product_name", type: "text" })
  productName!: string;

  @Column({ name: "amount_cents", type: "integer" })
  amountCents!: number;

  @Column({ type: "char", length: 3, default: "USD" })
  currency!: string;

  @Column({ name: "order_status", type: "text" })
  orderStatus!: "pending" | "confirmed" | "cancelled" | "refunded" | "fulfilled";

  @Column({ name: "payment_status", type: "text" })
  paymentStatus!: "unpaid" | "authorized" | "paid" | "failed" | "refunded";

  @Column({ name: "fulfillment_status", type: "text" })
  fulfillmentStatus!: "not_started" | "processing" | "shipped" | "delivered" | "cancelled";

  @Column({
    name: "search_document",
    type: "tsvector",
    asExpression: "to_tsvector('simple', order_number || ' ' || product_sku || ' ' || product_name)",
    generatedType: "STORED",
    select: false,
    insert: false,
    update: false
  })
  searchDocument!: string;

  @Column({ name: "customer_email", type: "text", nullable: true })
  customerEmail!: string | null;

  @Column({ name: "customer_name", type: "text", nullable: true })
  customerName!: string | null;

  @Column({ name: "subtotal_amount_cents", type: "integer", default: 0 })
  subtotalAmountCents!: number;

  @Column({ name: "discount_amount_cents", type: "integer", default: 0 })
  discountAmountCents!: number;

  @Column({ name: "tax_amount_cents", type: "integer", default: 0 })
  taxAmountCents!: number;

  @Column({ name: "shipping_amount_cents", type: "integer", default: 0 })
  shippingAmountCents!: number;

  @Column({ name: "total_amount_cents", type: "integer", default: 0 })
  totalAmountCents!: number;

  @Column({ name: "shipping_address", type: "jsonb", default: {} })
  shippingAddress!: unknown;

  @Column({ name: "billing_address", type: "jsonb", default: {} })
  billingAddress!: unknown;

  @Column({ name: "placed_at", type: "timestamptz", nullable: true })
  placedAt!: Date | null;

  @Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
  cancelledAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(() => OrderItemEntity, (item) => item.order)
  items!: OrderItemEntity[];
}
