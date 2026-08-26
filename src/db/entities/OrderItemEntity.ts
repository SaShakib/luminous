import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { OrderEntity } from "./OrderEntity";

@Entity({ name: "order_items" })
@Unique("uq_order_items_order_position", ["orderId", "position"])
@Check("chk_order_items_position", "position > 0")
@Check("chk_order_items_quantity", "quantity > 0")
@Check("chk_order_items_unit_price_cents", "unit_price_cents >= 0")
@Check("chk_order_items_total_price_cents", "total_price_cents >= 0")
export class OrderItemEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "order_id", type: "uuid" })
  orderId!: string;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order!: OrderEntity;

  @Column({ type: "integer" })
  position!: number;

  @Column({ name: "product_id", type: "uuid" })
  productId!: string;

  @Column({ name: "product_sku", type: "text" })
  productSku!: string;

  @Column({ name: "product_name", type: "text" })
  productName!: string;

  @Column({ type: "integer" })
  quantity!: number;

  @Column({ name: "unit_price_cents", type: "integer" })
  unitPriceCents!: number;

  @Column({ name: "total_price_cents", type: "integer" })
  totalPriceCents!: number;

  @Column({
    name: "search_document",
    type: "tsvector",
    asExpression: "to_tsvector('simple', product_sku || ' ' || product_name)",
    generatedType: "STORED",
    select: false,
    insert: false,
    update: false
  })
  searchDocument!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
