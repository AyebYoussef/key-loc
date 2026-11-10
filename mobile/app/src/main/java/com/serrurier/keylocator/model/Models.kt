package com.serrurier.keylocator.model

import com.google.gson.annotations.SerializedName

data class ModeleCle(
    val id: Int,
    val reference: String,
    val libelle: String,
    val description: String?
)

data class Casier(
    val id: Int,
    val code: String,
    val ligne: Int,
    val colonne: Int,
    @SerializedName("led_index") val ledIndex: Int?
)

data class Ebauche(
    val id: Int,
    @SerializedName("modele_id") val modeleId: Int,
    @SerializedName("casier_id") val casierId: Int,
    val quantite: Int,
    @SerializedName("statut_stock") val statutStock: String,
    val modele: ModeleCle?,
    val casier: Casier?
)

data class ScanResultat(
    val statut: String, // "succes", "photo_floue", "echec_confiance", "echec_detection"
    val message: String,
    val modele: ModeleCle?,
    @SerializedName("score_confiance") val scoreConfiance: Float?,
    val ebauche: Ebauche?,
    val casier: Casier?,
    val equivalences: List<ModeleCle>?,
    @SerializedName("scan_id") val scanId: Int?
)

data class LoginResponse(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("token_type") val tokenType: String
)

