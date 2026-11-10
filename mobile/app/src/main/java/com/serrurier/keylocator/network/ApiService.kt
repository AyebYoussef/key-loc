package com.serrurier.keylocator.network

import com.serrurier.keylocator.model.LoginResponse
import com.serrurier.keylocator.model.ScanResultat
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    @FormUrlEncoded
    @POST("api/auth/login")
    suspend fun login(
        @Field("username") email: String,
        @Field("password") motDePasse: String
    ): Response<LoginResponse>

    @Multipart
    @POST("api/scans/")
    suspend fun scannerCle(
        @Part photo: MultipartBody.Part,
        @Header("Authorization") token: String
    ): Response<ScanResultat>

    @POST("api/casiers/{id}/allumer")
    suspend fun allumerCasier(
        @Path("id") casierId: Int,
        @Body body: Map<String, Int>,
        @Header("Authorization") token: String
    ): Response<Any>
}

