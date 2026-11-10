package com.serrurier.keylocator.repository

import com.serrurier.keylocator.model.ScanResultat
import com.serrurier.keylocator.network.RetrofitClient
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File

class ScanRepository {
    private val api = RetrofitClient.apiService
    var authToken: String? = null

    suspend fun sAuthentifier(): Boolean {
        return try {
            val response = api.login("jean.dupont@keylocator.fr", "Password1!")
            if (response.isSuccessful && response.body() != null) {
                authToken = "Bearer " + response.body()!!.accessToken
                true
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    suspend fun envoyerPhotoCle(imageFile: File): Result<ScanResultat> {
        return try {
            if (authToken == null) {
                val ok = sAuthentifier()
                if (!ok) return Result.failure(Exception("Échec de connexion au backend"))
            }

            val requestFile = imageFile.asRequestBody("image/jpeg".toMediaTypeOrNull())
            val body = MultipartBody.Part.createFormData("photo", imageFile.name, requestFile)

            val response = api.scannerCle(body, authToken!!)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Erreur serveur : ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

