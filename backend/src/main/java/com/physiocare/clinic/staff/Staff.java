package com.physiocare.clinic.staff;
import jakarta.persistence.*;
@Entity @Table(name = "staff")
public class Staff {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable=false,length=150) private String name;
    @Column(name="name_en",nullable=false,length=150) private String nameEn;
    @Column(nullable=false,length=50) private String position;
    @Column(nullable=false,length=50) private String phone;
    @Column(nullable=false,length=255) private String email;
    @Column(name="branch_ids",nullable=false,columnDefinition="TEXT") private String branchIds;
    @Column(nullable=false,length=20) private String status;
    @Column(name="avatar_color",nullable=false,length=100) private String avatarColor;
    @Column(name="user_id",nullable=false,unique=true) private Long userId;
    @Column(name="deleted_at") private java.time.OffsetDateTime deletedAt;
    protected Staff() {}
    public Long getId(){return id;}
    public String getName(){return name;} public String getNameEn(){return nameEn;}
    public String getPosition(){return position;} public String getPhone(){return phone;}
    public String getEmail(){return email;} public String getBranchIds(){return branchIds;}
    public String getStatus(){return status;} public String getAvatarColor(){return avatarColor;}
    public Long getUserId(){return userId;}
    public java.time.OffsetDateTime getDeletedAt(){return deletedAt;}
    public void setName(String v){name=v;} public void setNameEn(String v){nameEn=v;}
    public void setPosition(String v){position=v;} public void setPhone(String v){phone=v;}
    public void setEmail(String v){email=v;} public void setBranchIds(String v){branchIds=v;}
    public void setStatus(String v){status=v;} public void setAvatarColor(String v){avatarColor=v;}
    public void setUserId(Long v){userId=v;}
    public void setDeletedAt(java.time.OffsetDateTime v){deletedAt=v;}
}
