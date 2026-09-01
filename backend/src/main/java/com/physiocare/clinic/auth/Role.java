package com.physiocare.clinic.auth;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Entity @Table(name = "roles")
public class Role {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true, length = 30) private String code;
    @Column(nullable = false, length = 100) private String name;
    @ManyToMany(mappedBy = "roles") private Set<AppUser> users = new HashSet<>();
    protected Role() {}
    public String getCode() { return code; }
    public String getName() { return name; }
}
