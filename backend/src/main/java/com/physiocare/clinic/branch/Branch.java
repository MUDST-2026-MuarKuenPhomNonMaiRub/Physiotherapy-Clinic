package com.physiocare.clinic.branch;
public record Branch(Long id,String code,String name,String phone,String address,boolean active) { public Branch withActive(boolean value){return new Branch(id,code,name,phone,address,value);} }
