package com.serrurier.keylocator.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.serrurier.keylocator.model.ScanResultat
import com.serrurier.keylocator.repository.ScanRepository
import kotlinx.coroutines.launch
import java.io.File

sealed class ScanUiState {
    object Idle : ScanUiState()
    object Loading : ScanUiState()
    data class Success(val resultat: ScanResultat) : ScanUiState()
    data class Error(val message: String) : ScanUiState()
}

class MainViewModel : ViewModel() {
    private val repository = ScanRepository()

    private val _uiState = MutableLiveData<ScanUiState>(ScanUiState.Idle)
    val uiState: LiveData<ScanUiState> = _uiState

    fun envoyerPhoto(imageFile: File) {
        _uiState.value = ScanUiState.Loading
        viewModelScope.launch {
            val result = repository.envoyerPhotoCle(imageFile)
            result.onSuccess { scanResultat ->
                _uiState.value = ScanUiState.Success(scanResultat)
            }.onFailure { exception ->
                _uiState.value = ScanUiState.Error(exception.message ?: "Erreur inconnue")
            }
        }
    }

    fun resetState() {
        _uiState.value = ScanUiState.Idle
    }
}

