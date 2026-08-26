import { Check, Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { OrderEntity } from "./OrderEntity";

@Entity({ name: "users" })
@Check("chk_users_role", "role IN ('user', 'admin')")
@Check("chk_users_status", "status IN ('active', 'disabled', 'pending')")
export class UserEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "text" })
  email!: string;

  @Column({ type: "text" })
  role!: "user" | "admin";

  @Column({ name: "first_name", type: "text", nullable: true })
  firstName!: string | null;

  @Column({ name: "last_name", type: "text", nullable: true })
  lastName!: string | null;

  @Column({ type: "text", nullable: true })
  phone!: string | null;

  @Column({ type: "text", default: "active" })
  status!: "active" | "disabled" | "pending";

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @OneToMany(() => OrderEntity, (order) => order.user)
  orders!: OrderEntity[];
}
